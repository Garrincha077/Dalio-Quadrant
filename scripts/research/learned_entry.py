"""Nested chronological learning of macro-conditioned asset entry returns.

Revised and exact-vintage information sets are separate experiments. No random
split, future label, future scaler or later vintage enters an earlier model.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from extended_state import ROOT, digest, load_panel
from entry_opportunities import bootstrap, episode_indices, holm, nonoverlap_count

VERSION = 'learned-entry-1'
HORIZONS = (3, 12, 36)
POLICIES = ('fixed', 'calibrated', 'linear', 'curved', 'selected', 'timing_selected')
MIN_TRAIN = 60
SCORE_EPS = 1e-12


def enters(values, threshold):
    values = np.asarray(values)
    return (values > SCORE_EPS) & (values >= threshold-SCORE_EPS)


def specs():
    grid = [{'id': f'quad:{a}:{p}', 'family': 'calibrated', 'a': a, 'p': p}
            for a in (-.2, 0., .2) for p in (1.5, 2., 2.5)]
    ridge = [{'id': f'{family}:{penalty}:{half}', 'family': family, 'penalty': penalty, 'halfLife': half}
             for family in ('linear', 'curved') for penalty in (10, 100) for half in (0, 120)]
    return grid + ridge


SPECS = specs()
FIXED = {'id': 'fixed:0:2', 'family': 'fixed', 'a': 0., 'p': 2.}
DEFAULTS = {'calibrated': next(s for s in SPECS if s['id']=='quad:0.0:2.0'),
            'linear': next(s for s in SPECS if s['id']=='linear:100:0'),
            'curved': next(s for s in SPECS if s['id']=='curved:100:0')}


def basis(x, curved=False):
    x = np.asarray(x, dtype=float).reshape((-1, 4))
    return np.column_stack([x, x[:, 0]**2, x[:, 1]**2, x[:, 0]*x[:, 1]]) if curved else x


def group(x, a, p):
    x = np.asarray(x, dtype=float).reshape((-1, 4))
    q = (x[:, 0] > a).astype(int)*2 + (x[:, 1] > p).astype(int)
    q[(np.abs(x[:, 0]-a)<=1e-9) | (np.abs(x[:, 1]-p)<=1e-9)] = -1
    return q


def score(model, x):
    x = np.asarray(x, dtype=float).reshape((-1, 4))
    if model['spec']['family'] == 'unconditional':
        return np.zeros(len(x))
    if model['spec']['family'] in ('fixed', 'calibrated'):
        groups = group(x, model['spec']['a'], model['spec']['p'])
        return np.array([model['cellScores'][q] if q >= 0 else 0. for q in groups])
    clipped = np.clip(x, model['clipLow'], model['clipHigh'])
    z = (basis(clipped, model['spec']['family']=='curved')-model['means'])/model['scales']
    return z@np.asarray(model['beta'])


def fit(x, y, ages, spec):
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    if len(y) < MIN_TRAIN or not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Need 60 finite matured training labels')
    half = spec.get('halfLife', 0)
    weights = np.exp(-np.log(2)*np.asarray(ages)/half) if half else np.ones(len(y))
    weights *= len(y)/weights.sum()
    baseline = float(np.average(y, weights=weights))
    model = {'spec': spec, 'baseline': baseline, 'n': len(y),
             'effectiveN': float(weights.sum()**2/(weights@weights))}
    if spec['family'] == 'unconditional':
        model['threshold'] = 0.
        return model
    if spec['family'] in ('fixed', 'calibrated'):
        groups = group(x, spec['a'], spec['p'])
        cell_scores = []
        for q in range(4):
            selected = groups == q
            n = float(weights[selected].sum())
            cell_scores.append(float(np.sum(weights[selected]*(y[selected]-baseline))/(n+24)))
        model['cellScores'] = cell_scores
    else:
        low, high = np.quantile(x, [.01, .99], axis=0)
        expanded = basis(np.clip(x, low, high), spec['family']=='curved')
        means = np.average(expanded, axis=0, weights=weights)
        scales = np.sqrt(np.average((expanded-means)**2, axis=0, weights=weights))
        scales[scales < 1e-12] = 1.
        z = (expanded-means)/scales
        penalty = spec['penalty']
        beta = np.linalg.solve(z.T@(weights[:, None]*z)+penalty*np.eye(z.shape[1]), z.T@(weights*(y-baseline)))
        model.update({'clipLow': low.tolist(), 'clipHigh': high.tolist(),
                      'means': means.tolist(), 'scales': scales.tolist(), 'beta': beta.tolist()})
    model['threshold'] = float(np.quantile(score(model, x), .75))
    return model


def macro_frame(series):
    """Exact monthly PCE year-earlier base; do not fill absent observations."""
    def values(points):
        out = {}
        seen = set()
        for p in points:
            m = pd.Period(p.get('month', p.get('date')), freq='M')
            if m in seen:
                raise ValueError('Duplicate macro month')
            seen.add(m)
            if p['value'] not in (None, '.'):
                v = float(p['value'])
                if not np.isfinite(v):
                    raise ValueError('Invalid macro value')
                out[m] = v
        return out
    a = values(series['CFNAIMA3']['observations'])
    p = values(series['PCEPI']['observations'])
    if any(v <= 0 for v in p.values()):
        raise ValueError('PCE price-index levels must be positive')
    out = {}
    for m in sorted(a):
        if m in p and m-12 in p and p[m-12] > 0:
            out[m] = (a[m], 100*(p[m]/p[m-12]-1))
    return out


def feature(frame, reference):
    rows = [frame.get(reference-i) for i in (3, 2, 1, 0)]
    if any(r is None for r in rows):
        return None
    a, p = rows[-1]
    return np.array([a, p, a-rows[0][0], p-rows[0][1]], dtype=float)


class Dataset:
    def __init__(self, manifest, information, as_of, vintage_dir=None):
        self.prices, self.dates, self.metadata, self.price_path = load_panel(manifest, as_of)
        self.manifest = manifest
        self.assets = list(self.prices.columns[:-1])
        self.information = information
        self.vintage_dir = Path(vintage_dir) if vintage_dir else None
        self.vintage_manifest = None
        if information == 'vintage' and self.vintage_dir and (self.vintage_dir/'manifest.json').exists():
            self.vintage_manifest = json.loads((self.vintage_dir/'manifest.json').read_text())
        self.snapshot_hashes = {r['cutoff']: r['sha256'] for r in self.vintage_manifest['snapshots']} if self.vintage_manifest else {}
        raw = json.loads((ROOT/'data/state-forward.json').read_text())
        self.revised = {pd.Period(p['month'], freq='M'): (p['activity'], p['inflation']) for p in raw['points']}
        schedule = json.loads(Path(__file__).with_name('state-vintage-schedule.json').read_text())
        self.schedule = {pd.Period(r['entryMonth'], freq='M'): r for r in schedule}
        self.frames, self.prepared = {}, {}

    def frame(self, entry):
        if self.information == 'revised':
            return self.revised
        if entry not in self.frames:
            row = self.schedule.get(entry)
            filename = self.vintage_dir/(row['cutoff']+'.json') if row else None
            if filename is None or not filename.exists():
                self.frames[entry] = None
            else:
                if self.snapshot_hashes.get(row['cutoff']) != digest(filename):
                    raise ValueError('Vintage snapshot does not match its collection manifest')
                raw = json.loads(filename.read_text())
                if raw['cutoff'] != row['cutoff'] or raw['tradeDate'] != row['tradeDate']:
                    raise ValueError('Vintage date/provenance mismatch')
                if any(p.get('realtime_start') != row['cutoff'] or p.get('realtime_end') != row['cutoff']
                       for s in raw['series'].values() for p in s['observations']):
                    raise ValueError('Observation is not from the requested real-time cutoff')
                self.frames[entry] = macro_frame(raw['series'])
        return self.frames[entry]

    def x(self, entry):
        frame = self.frame(entry)
        return feature(frame, entry-2) if frame is not None else None

    def outcome(self, entry, horizon, asset):
        exit_month = entry+horizon
        if entry not in self.prices.index or exit_month not in self.prices.index:
            return None
        if not pd.period_range(entry, exit_month, freq='M').isin(self.prices.index).all():
            return None
        return float(self.prices.loc[exit_month, asset]/self.prices.loc[entry, asset]*.999/1.001-1)

    def train(self, refit, horizon, asset):
        key = refit, horizon, asset
        if key in self.prepared:
            return self.prepared[key]
        frame = self.frame(refit)
        rows, xs, ys = [], [], []
        if frame is not None:
            for entry in self.prices.index:
                if entry+horizon >= refit:
                    continue
                x = feature(frame, entry-2)
                y = self.outcome(entry, horizon, asset)
                if x is not None and y is not None:
                    rows.append(entry)
                    xs.append(x)
                    ys.append(y)
        result = (rows, np.array(xs, dtype=float).reshape((-1, 4)), np.array(ys))
        self.prepared[key] = result
        return result

    def vintage_cutoff(self, entry):
        if self.information == 'revised':
            return None
        row = self.schedule.get(entry)
        return row['cutoff'] if row else None


def ages_at(rows, refit):
    return np.array([refit.ordinal-r.ordinal for r in rows], dtype=float)


def validation_folds(dataset, refit, horizon, asset):
    folds = []
    earliest = dataset.prices.index.min().year
    for year in range(refit.year-1, earliest-1, -1):
        origin = pd.Period(year=year, month=1, freq='M')
        if origin+11+horizon >= refit:
            continue
        rows, x, y = dataset.train(origin, horizon, asset)
        if len(y) < MIN_TRAIN:
            continue
        targets = []
        for m in pd.period_range(origin, origin+11, freq='M'):
            target, actual = dataset.x(m), dataset.outcome(m, horizon, asset)
            if target is not None and actual is not None:
                targets.append((m, target, actual))
        if targets:
            folds.append((origin, rows, x, y, targets))
        if len(folds) == 5:
            break
    return list(reversed(folds))


def choose(dataset, refit, horizon, asset):
    folds = validation_folds(dataset, refit, horizon, asset)
    n = sum(len(f[-1]) for f in folds)
    if len(folds) < 3 or n < 24:
        return {**DEFAULTS, 'selected': DEFAULTS['linear'], 'timing_selected': DEFAULTS['linear']}, {
            'fallback': True, 'folds': len(folds), 'nValidation': n,
            'reason': 'Fewer than three historical validation folds or 24 paired predictions.', 'candidates': []}
    results = []
    for spec in SPECS:
        differences, cv_returns, cv_entries, cv_dates = [], [], [], []
        for origin, rows, x, y, targets in folds:
            model = fit(x, y, ages_at(rows, origin), spec)
            tx = np.array([t[1] for t in targets])
            ty = np.array([t[2] for t in targets])
            s = score(model, tx)
            differences.extend(((ty-model['baseline']-s)**2-(ty-model['baseline'])**2).tolist())
            cv_returns.extend(ty.tolist())
            cv_entries.extend(enters(s, model['threshold']).tolist())
            cv_dates.extend([{'reference': str(t[0])} for t in targets])
        selected_mask = np.array(cv_entries, dtype=bool)
        values = np.array(cv_returns)
        episodes = len(episode_indices(cv_dates, selected_mask))
        results.append({'id': spec['id'], 'deltaMSE': float(np.mean(differences)), 'n': len(differences),
                        'entryStarts': int(selected_mask.sum()), 'entryEpisodes': episodes,
                        'entryLift': float(values[selected_mask].mean()-values.mean()) if selected_mask.any() else None})
    lookup = {s['id']: s for s in SPECS}
    order = sorted(results, key=lambda r: (r['deltaMSE'], r['id']))
    selected = {}
    for family in ('calibrated', 'linear', 'curved'):
        winner = next(r for r in order if lookup[r['id']]['family'] == family)
        selected[family] = lookup[winner['id']]
    selected['selected'] = lookup[order[0]['id']] if order[0]['deltaMSE'] < 0 else {'id': 'unconditional', 'family': 'unconditional'}
    timing = [r for r in results if r['entryStarts'] >= 12 and r['entryEpisodes'] >= 3 and r['entryLift'] is not None and r['entryLift'] > 0]
    selected['timing_selected'] = lookup[sorted(timing, key=lambda r: (-r['entryLift'], r['id']))[0]['id']] if timing else {'id': 'unconditional', 'family': 'unconditional'}
    return selected, {'fallback': False, 'folds': len(folds), 'nValidation': n,
                      'lastValidationExit': str(max(t[0]+horizon for f in folds for t in f[-1])), 'candidates': results}


def model_id(model):
    return hashlib.sha256(json.dumps(model, sort_keys=True).encode()).hexdigest()[:20]


def metrics(records, policy, horizon, draws=5000):
    if not records:
        return {'nScored': 0, 'selectedStarts': 0, 'lift': None, 'reason': 'No eligible complete forecasts.'}
    y = np.array([r['actual'] for r in records])
    s = np.array([r['policies'][policy]['score'] for r in records])
    base = np.array([r['policies'][policy]['baseline'] for r in records])
    selected = np.array([r['policies'][policy]['enter'] for r in records])
    result = {'nScored': len(y), 'selectedStarts': int(selected.sum()),
              'coverage': float(selected.mean()), 'usualMean': float(y.mean()),
              'deltaMSE': float(np.mean((y-base-s)**2-(y-base)**2)),
              'rankIC': float(pd.Series(s).rank().corr(pd.Series(y).rank())) if np.std(s)>1e-12 and np.std(y)>1e-12 else None,
              'firstEntry': records[0]['entry'], 'lastEntry': records[-1]['entry'],
              'lastExit': max(r['exit'] for r in records)}
    clock = [{'reference': r['entry'], 'entry': r['entry']} for r in records]
    groups = episode_indices(clock, selected)
    result.update({'episodes': len(groups), 'nonoverlappingStarts': nonoverlap_count(clock, selected, horizon),
                   'supported': int(selected.sum()) >= 24 and len(groups) >= 6})
    if not selected.any():
        result.update({'mean': None, 'lift': None, 'liftCI95': None, 'bootstrapP': None,
                       'reason': 'No macro-conditioned entry selected; not a zero-return strategy.'})
        return result
    chosen = y[selected]
    result.update({'mean': float(chosen.mean()), 'lift': float(chosen.mean()-y.mean()),
                   'median': float(np.median(chosen)), 'p10': float(np.quantile(chosen, .1)),
                   'lossFrequency': float((chosen<0).mean())})
    boot = bootstrap(clock, y[:, None], selected[:, None].astype(float), horizon, draws)[0, 0]
    result.update(boot)
    stress = (1+y)*(.9975/1.0025)/(.999/1.001)-1
    result['stress25bpLift'] = float(stress[selected].mean()-stress.mean())
    return result


def run_panel(dataset, name, draws):
    models, targets = {}, []
    start = pd.Period('1990-01' if name=='long' else '2016-01', freq='M')
    for h in HORIZONS:
        for asset in dataset.assets:
            decisions, refits = [], []
            for year in range(start.year, dataset.prices.index.max().year+1):
                refit = pd.Period(year=year, month=1, freq='M')
                rows, x, y = dataset.train(refit, h, asset)
                if len(y) < MIN_TRAIN:
                    continue
                choices, selection = choose(dataset, refit, h, asset)
                choices['fixed'] = FIXED
                refs = {}
                for policy in POLICIES:
                    model = fit(x, y, ages_at(rows, refit), choices[policy])
                    model.update({'refitMonth': str(refit), 'asset': asset, 'horizon': h,
                                  'information': dataset.information, 'vintageCutoff': dataset.vintage_cutoff(refit),
                                  'firstTrainingEntry': str(rows[0]), 'lastTrainingExit': str(rows[-1]+h)})
                    key = model_id(model)
                    models[key] = model
                    refs[policy] = key
                refits.append({'refitMonth': str(refit), 'models': refs, **selection})
                before = len(decisions)
                for entry in pd.period_range(refit, refit+11, freq='M'):
                    actual = dataset.outcome(entry, h, asset)
                    tx = dataset.x(entry)
                    if actual is None or tx is None:
                        continue
                    policies = {}
                    for policy in POLICIES:
                        model = models[refs[policy]]
                        s = float(score(model, tx)[0])
                        policies[policy] = {'model': refs[policy], 'score': s, 'baseline': model['baseline'],
                                            'enter': bool(enters(s, model['threshold']))}
                    decisions.append({'entry': str(entry), 'exit': str(entry+h), 'reference': str(entry-2),
                                      'vintageCutoff': dataset.vintage_cutoff(entry), 'x': tx.tolist(),
                                      'actual': actual, 'policies': policies})
                refits[-1]['scoredEntries'] = len(decisions)-before
            results = {policy: metrics(decisions, policy, h, draws) for policy in POLICIES}
            # Keep compact selected-policy forecasts; the other policies can be independently
            # reconstructed from the same raw features and their annual model references.
            export = [{'entry': r['entry'], 'exit': r['exit'], 'reference': r['reference'],
                       'vintageCutoff': r['vintageCutoff'], 'x': r['x'], 'actual': r['actual'],
                       **r['policies']['timing_selected']} for r in decisions]
            targets.append({'asset': asset, 'horizon': h, 'results': results, 'refits': refits, 'selectedForecasts': export})
    entries = [(target, policy, values) for target in targets for policy, values in target['results'].items()]
    adjusted = holm([v.get('bootstrapP') if v.get('supported') else None for _, _, v in entries])
    for (_, _, values), p in zip(entries, adjusted):
        values['holmP'] = p
    return {'panel': name, 'information': dataset.information, 'assets': dataset.metadata['assets'],
            'sourceLimitations': dataset.metadata.get('limitations', []),
            'priceStart': str(dataset.prices.index.min()), 'priceEnd': str(dataset.prices.index.max()),
            'sourceHashes': {'manifest': digest(dataset.manifest), 'prices': digest(dataset.price_path)},
            'models': models, 'targets': targets,
            'availability': {'snapshotsLoaded': sum(v is not None for v in dataset.frames.values()),
                             'snapshotsUnavailableIncludingPreArchive': sum(v is None for v in dataset.frames.values()),
                             'vintageManifestSha256': digest(dataset.vintage_dir/'manifest.json') if dataset.vintage_manifest else None,
                             'firstArchivedVintage': dataset.vintage_manifest['series'] if dataset.vintage_manifest else None},
            'supportedComparisons': sum(v.get('supported', False) for _, _, v in entries)}


def common_dates(panels):
    comparisons = []
    for name in ('long', 'etf'):
        sources = {p['information']: p for p in panels if p['panel'] == name}
        if set(sources) != {'revised', 'vintage'}:
            continue
        for a in sources['revised']['targets']:
            b = next(t for t in sources['vintage']['targets'] if t['asset']==a['asset'] and t['horizon']==a['horizon'])
            left = {r['entry']: r for r in a['selectedForecasts']}
            right = {r['entry']: r for r in b['selectedForecasts']}
            shared = sorted(set(left)&set(right))
            if not shared:
                continue
            values = {}
            for information, lookup, panel, target in [('revised', left, sources['revised'], a), ('vintage', right, sources['vintage'], b)]:
                baselines = np.array([lookup[m]['actual'] for m in shared])
                policies = {}
                for policy in ('fixed', 'timing_selected'):
                    selected = []
                    for m in shared:
                        fitrow = next(f for f in target['refits'] if f['refitMonth'][:4] == m[:4])
                        model = panel['models'][fitrow['models'][policy]]
                        s = float(score(model, lookup[m]['x'])[0])
                        selected.append(bool(enters(s, model['threshold'])))
                    selected = np.array(selected)
                    policies[policy] = {'selectedStarts': int(selected.sum()), 'usualMean': float(baselines.mean()),
                                        'mean': float(baselines[selected].mean()) if selected.any() else None,
                                        'lift': float(baselines[selected].mean()-baselines.mean()) if selected.any() else None}
                values[information] = policies
            comparisons.append({'panel': name, 'asset': a['asset'], 'horizon': a['horizon'],
                                'nCommon': len(shared), 'firstEntry': shared[0], 'lastEntry': shared[-1], 'results': values})
    return comparisons


def build(args):
    report = {'version': VERSION, 'asOf': args.as_of, 'builderSha256': digest(__file__),
              'protocolSha256': digest(Path(__file__).with_name('learned-entry-protocol.md')),
              'dependencies': {p: digest(Path(__file__).with_name(p)) for p in ('extended_state.py', 'entry_opportunities.py')},
              'stateSourceSha256': digest(ROOT/'data/state-forward.json'),
              'horizons': list(HORIZONS), 'policies': list(POLICIES), 'candidateCount': len(SPECS),
              'bootstrapDraws': args.draws, 'panels': [],
              'limitations': ['Annual refitting with matured labels and nested chronological selection.',
                              'Revised-history results are not historical publication-vintage evidence.',
                              'Vintage fitting uses full historical reconstructions published by each refit date.',
                              'Previously researched periods; neither panel is a newly untouched holdout.',
                              'Long proxies include reconstructed bonds and average gold, ending May 2025.']}
    for information in args.information:
        for name, manifest in [('long', args.long_manifest), ('etf', args.etf_manifest)]:
            dataset = Dataset(manifest, information, args.as_of, args.vintages)
            if information=='vintage' and not any(Path(args.vintages).glob('????-??-??.json')):
                continue
            panel = run_panel(dataset, name, args.draws)
            report['panels'].append(panel)
            print(name, information, 'models', len(panel['models']), 'forecasts', sum(len(t['selectedForecasts']) for t in panel['targets']), flush=True)
    report['commonDateComparison'] = common_dates(report['panels'])
    manifest = Path(args.vintages)/'manifest.json'
    if manifest.exists():
        collection = json.loads(manifest.read_text())
        report['vintageCollection'] = {'manifestSha256': digest(manifest), 'series': collection['series'],
                                      'completeSnapshots': len(collection['snapshots']),
                                      'unavailableCutoffs': len(collection['unavailable']), 'failures': len(collection['failures']),
                                      'firstCutoff': collection['snapshots'][0]['cutoff'] if collection['snapshots'] else None,
                                      'lastCutoff': collection['snapshots'][-1]['cutoff'] if collection['snapshots'] else None,
                                      'sourceRun': 'https://github.com/Garrincha077/Dalio-Quadrant/actions/runs/40311799966'}
    output = Path(args.output)
    output.write_text(json.dumps(report, separators=(',', ':'), allow_nan=False)+'\n')
    with output.with_suffix('.csv').open('w', newline='') as f:
        fields = ['panel', 'information', 'asset', 'horizon', 'entry', 'exit', 'reference', 'vintageCutoff', 'actual', 'score', 'baseline', 'enter', 'model']
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore', lineterminator='\n')
        writer.writeheader()
        for panel in report['panels']:
            for t in panel['targets']:
                for row in t['selectedForecasts']:
                    writer.writerow({'panel': panel['panel'], 'information': panel['information'], 'asset': t['asset'], 'horizon': t['horizon'], **row})
    print('Wrote', output, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    folder = ROOT/'work/research/extended'
    parser.add_argument('--long-manifest', default=str(folder/'long-manifest.json'))
    parser.add_argument('--etf-manifest', default=str(folder/'etf-manifest.json'))
    parser.add_argument('--vintages', default=str(ROOT/'work/research/state-vintages'))
    parser.add_argument('--information', nargs='+', choices=['revised', 'vintage'], default=['revised', 'vintage'])
    parser.add_argument('--as-of', default='2026-10-26')
    parser.add_argument('--draws', type=int, default=5000)
    parser.add_argument('--output', default=str(ROOT/'data/learned-entry.json'))
    build(parser.parse_args())
