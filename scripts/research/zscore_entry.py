"""Matched chronological price-position / macro entry experiments.

See zscore-entry-protocol.md. No modification of the earlier frozen research.
"""
import argparse
import csv
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from extended_state import ROOT, digest
from learned_entry import (Dataset, MIN_TRAIN, HORIZONS, ages_at, enters,
                           feature, metrics, model_id)
from entry_opportunities import SEED, episode_indices, holm

VERSION = 'zscore-entry-1'
POLICIES = ('macro', 'price', 'joint', 'interaction')
WINDOWS = (36, 60)


def trailing_z(prices, entry, window):
    """Use exactly L prior months; current entry close is deliberately excluded."""
    block = prices.reindex(pd.period_range(entry-window, entry-1, freq='M'))
    values = block.to_numpy(dtype=float)
    if len(values) != window or not np.isfinite(values).all() or (values <= 0).any():
        return None
    logs = np.log(values)
    sd = float(np.std(logs, ddof=1))
    return float((logs[-1]-logs.mean())/sd) if sd >= 1e-12 else None


def candidates(family):
    return [{'id': f'{family}:{penalty}:{half}', 'family': family,
             'penalty': penalty, 'halfLife': half}
            for penalty in (10, 100) for half in (0, 120)]


def expand(x, family):
    x = np.asarray(x, dtype=float).reshape((-1, 5))
    if family == 'macro':
        return x[:, :4]
    if family == 'price':
        return x[:, 4:5]
    if family == 'joint':
        return x
    if family == 'interaction':
        return np.column_stack([x, x[:, :4]*x[:, 4:5]])
    raise ValueError('Unknown feature family')


def predict(model, x):
    x = np.asarray(x, dtype=float).reshape((-1, 5))
    if model['spec']['family'] == 'unconditional':
        return np.zeros(len(x))
    values = expand(np.clip(x, model['clipLow'], model['clipHigh']), model['spec']['family'])
    return ((values-model['means'])/model['scales'])@np.asarray(model['beta'])


def fit(x, y, ages, spec):
    x, y = np.asarray(x, dtype=float).reshape((-1, 5)), np.asarray(y, dtype=float)
    if len(y) < MIN_TRAIN or not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Need 60 finite matured training labels')
    half = spec.get('halfLife', 0)
    weights = np.exp(-np.log(2)*np.asarray(ages)/half) if half else np.ones(len(y))
    weights *= len(y)/weights.sum()
    baseline = float(np.average(y, weights=weights))
    model = {'spec': spec, 'baseline': baseline, 'n': len(y),
             'effectiveN': float(weights.sum()**2/(weights@weights))}
    if spec['family'] == 'unconditional':
        return {**model, 'threshold': 0.}
    low, high = np.quantile(x, [.01, .99], axis=0)
    values = expand(np.clip(x, low, high), spec['family'])
    means = np.average(values, axis=0, weights=weights)
    scales = np.sqrt(np.average((values-means)**2, axis=0, weights=weights))
    scales[scales < 1e-12] = 1.
    z = (values-means)/scales
    beta = np.linalg.solve(z.T@(weights[:, None]*z)+spec['penalty']*np.eye(z.shape[1]),
                           z.T@(weights*(y-baseline)))
    model.update({'clipLow': low.tolist(), 'clipHigh': high.tolist(),
                  'means': means.tolist(), 'scales': scales.tolist(), 'beta': beta.tolist()})
    model['threshold'] = float(np.quantile(predict(model, x), .75))
    return model


class PriceDataset(Dataset):
    def __init__(self, manifest, information, as_of, vintage_dir, window):
        super().__init__(manifest, information, as_of, vintage_dir)
        self.window = window
        self.price_features = {(a, m): trailing_z(self.prices[a], m, window)
                               for a in self.assets for m in self.prices.index}

    def joined(self, frame, entry, asset):
        raw = feature(frame, entry-2) if frame is not None else None
        z = self.price_features.get((asset, entry))
        return np.append(raw, z) if raw is not None and z is not None else None

    def x(self, entry, asset):
        return self.joined(self.frame(entry), entry, asset)

    def train(self, refit, horizon, asset):
        key = refit, horizon, asset
        if key not in self.prepared:
            frame = self.frame(refit)
            rows, xs, ys = [], [], []
            if frame is not None:
                for entry in self.prices.index:
                    if entry+horizon >= refit:
                        continue
                    x, y = self.joined(frame, entry, asset), self.outcome(entry, horizon, asset)
                    if x is not None and y is not None:
                        rows.append(entry); xs.append(x); ys.append(y)
            self.prepared[key] = rows, np.array(xs).reshape((-1, 5)), np.array(ys)
        return self.prepared[key]


def folds_at(dataset, refit, horizon, asset):
    folds = []
    for year in range(refit.year-1, dataset.prices.index.min().year-1, -1):
        origin = pd.Period(year=year, month=1, freq='M')
        if origin+11+horizon >= refit:
            continue
        rows, x, y = dataset.train(origin, horizon, asset)
        if len(y) < MIN_TRAIN:
            continue
        targets = []
        for m in pd.period_range(origin, origin+11, freq='M'):
            tx, ty = dataset.x(m, asset), dataset.outcome(m, horizon, asset)
            if tx is not None and ty is not None:
                targets.append((m, tx, ty))
        if targets:
            folds.append((origin, rows, x, y, targets))
        if len(folds) == 5:
            break
    return list(reversed(folds))


def choose(dataset, refit, horizon, asset):
    folds = folds_at(dataset, refit, horizon, asset)
    n = sum(len(f[-1]) for f in folds)
    trace = {'folds': len(folds), 'nValidation': n, 'fallback': len(folds)<3 or n<24,
             'candidates': []}
    if trace['fallback']:
        return {f: {'id': f'{f}:100:0', 'family': f, 'penalty': 100, 'halfLife': 0}
                for f in POLICIES}, trace
    trace['lastValidationExit'] = str(max(t[0]+horizon for f in folds for t in f[-1]))
    choices = {}
    for family in POLICIES:
        for spec in candidates(family):
            values, masks, clock = [], [], []
            for origin, rows, x, y, targets in folds:
                model = fit(x, y, ages_at(rows, origin), spec)
                scores = predict(model, [t[1] for t in targets])
                values.extend(t[2] for t in targets)
                masks.extend(enters(scores, model['threshold']).tolist())
                clock.extend({'reference': str(t[0])} for t in targets)
            values, mask = np.array(values), np.array(masks, dtype=bool)
            trace['candidates'].append({'id': spec['id'], 'family': family, 'n': len(values),
                'entryStarts': int(mask.sum()), 'entryEpisodes': len(episode_indices(clock, mask)),
                'entryLift': float(values[mask].mean()-values.mean()) if mask.any() else None})
        valid = [r for r in trace['candidates'] if r['family']==family and r['entryStarts']>=12
                 and r['entryEpisodes']>=3 and r['entryLift'] is not None and r['entryLift']>0]
        winner = sorted(valid, key=lambda r: (-r['entryLift'], r['id']))[0]['id'] if valid else None
        choices[family] = next((s for s in candidates(family) if s['id']==winner),
                               {'id': 'unconditional', 'family': 'unconditional'})
    return choices, trace


def incremental(records, family, horizon, draws):
    """Paired difference of selected means; their identical usual baseline cancels."""
    y = np.array([r['actual'] for r in records])
    left = np.array([r['policies'][family]['enter'] for r in records], dtype=bool)
    right = np.array([r['policies']['macro']['enter'] for r in records], dtype=bool)
    if not left.any() or not right.any():
        return {'gain': None, 'gainCI95': None, 'bootstrapP': None, 'validDraws': 0,
                'reason': 'At least one procedure selected no entries.'}
    observed = float(y[left].mean()-y[right].mean())
    first, last = (pd.Period(records[i]['entry'], freq='M') for i in (0, -1))
    length = last.ordinal-first.ordinal+1
    positions = np.array([pd.Period(r['entry'], freq='M').ordinal-first.ordinal for r in records])
    block = max(12, horizon)
    rng = np.random.default_rng(SEED+horizon)
    starts = rng.integers(0, length, size=(draws, math.ceil(length/block)))
    ix = ((starts[:, :, None]+np.arange(block)) % length).reshape(draws, -1)[:, :length]
    freq = np.array([np.bincount(row, minlength=length)[positions] for row in ix], dtype=float)
    masks = np.column_stack([left, right]).astype(float)
    count, sums = freq@masks, freq@(masks*y[:, None])
    means = np.divide(sums, count, out=np.full(sums.shape, np.nan), where=count>0)
    delta = means[:, 0]-means[:, 1]
    delta = delta[np.isfinite(delta)]
    good = len(delta)>=.8*draws
    return {'gain': observed, 'gainCI95': np.quantile(delta, [.025, .975]).tolist() if good else None,
            'bootstrapP': float((1+np.sum(np.abs(delta-observed)>=abs(observed)-1e-14))/(1+len(delta))) if good else None,
            'validDraws': len(delta), 'blockMonths': block}


def run(dataset, panel_name, draws):
    models, targets = {}, []
    start = 1990 if panel_name=='long' else 2016
    for h in HORIZONS:
        for asset in dataset.assets:
            records, refits = [], []
            for year in range(start, dataset.prices.index.max().year+1):
                refit = pd.Period(year=year, month=1, freq='M')
                rows, x, y = dataset.train(refit, h, asset)
                if len(y)<MIN_TRAIN:
                    continue
                choices, trace = choose(dataset, refit, h, asset)
                refs = {}
                for family in POLICIES:
                    model = fit(x, y, ages_at(rows, refit), choices[family])
                    model.update({'refitMonth': str(refit), 'asset': asset, 'horizon': h,
                                  'window': dataset.window, 'information': dataset.information,
                                  'vintageCutoff': dataset.vintage_cutoff(refit),
                                  'firstTrainingEntry': str(rows[0]), 'lastTrainingExit': str(rows[-1]+h)})
                    key = model_id(model); models[key] = model; refs[family] = key
                before = len(records)
                for entry in pd.period_range(refit, refit+11, freq='M'):
                    tx, actual = dataset.x(entry, asset), dataset.outcome(entry, h, asset)
                    if tx is None or actual is None:
                        continue
                    policies = {}
                    for family in POLICIES:
                        model = models[refs[family]]
                        value = float(predict(model, tx)[0])
                        policies[family] = {'score': value, 'baseline': model['baseline'],
                                            'enter': bool(enters(value, model['threshold']))}
                    records.append({'entry': str(entry), 'exit': str(entry+h), 'x': tx.tolist(),
                                    'actual': actual, 'policies': policies})
                refits.append({'refitMonth': str(refit), 'models': refs,
                               'scoredEntries': len(records)-before, **trace})
            results = {p: metrics(records, p, h, draws) for p in POLICIES}
            extra = {p: incremental(records, p, h, draws) for p in POLICIES if p!='macro'} if records else {}
            for p, r in extra.items():
                r['supported'] = results[p].get('supported', False) and results['macro'].get('supported', False)
            # Model IDs in the annual refits reconstruct every dated family decision.
            forecasts = [{k: r[k] for k in ('entry', 'exit', 'x', 'actual')} for r in records]
            targets.append({'asset': asset, 'horizon': h, 'results': results,
                            'incremental': extra, 'refits': refits, 'forecasts': forecasts})
            print(panel_name, dataset.information, dataset.window, asset, h, len(records), flush=True)
    return {'panel': panel_name, 'information': dataset.information, 'window': dataset.window,
            'priceStart': str(dataset.prices.index.min()), 'priceEnd': str(dataset.prices.index.max()),
            'assets': dataset.metadata['assets'], 'sourceLimitations': dataset.metadata.get('limitations', []),
            'sourceHashes': {'manifest': digest(dataset.manifest), 'prices': digest(dataset.price_path),
                             'vintageManifest': digest(dataset.vintage_dir/'manifest.json') if dataset.vintage_manifest else None},
            'models': models, 'targets': targets}


def build(args):
    report = {'version': VERSION, 'asOf': args.as_of, 'primaryWindow': 36, 'windows': list(WINDOWS),
              'horizons': list(HORIZONS), 'policies': list(POLICIES), 'bootstrapDraws': args.draws,
              'builderSha256': digest(__file__), 'protocolSha256': digest(Path(__file__).with_name('zscore-entry-protocol.md')),
              'dependencies': {p: digest(Path(__file__).with_name(p)) for p in ('learned_entry.py', 'extended_state.py', 'entry_opportunities.py')},
              'stateSourceSha256': digest(ROOT/'data/state-forward.json'), 'panels': [],
              'definition': 'Previous-close log-price position within L prior months; sample SD, lag 1, no entry-month close.',
              'limitations': ['Price position is not fundamental valuation; trend and distributions affect it.',
                              'Long proxies contain reconstructed bonds and monthly-average gold.',
                              'Macro-only control is four ridge candidates, not the previous 17-candidate selector.',
                              'Previously researched periods; exploratory extension, not prospective evidence.',
                              'Paired comparisons require both procedures to select entries; no entry is not zero return.']}
    for info in args.information:
        for name, manifest in [('long', args.long_manifest), ('etf', args.etf_manifest)]:
            for window in WINDOWS:
                dataset = PriceDataset(manifest, info, args.as_of, args.vintages, window)
                report['panels'].append(run(dataset, name, args.draws))
    # The two window variants share a single multiplicity family per panel/info.
    for info in args.information:
        for name in ('long', 'etf'):
            rows = [r for p in report['panels'] if p['information']==info and p['panel']==name
                    for t in p['targets'] for section in ('results', 'incremental') for r in t[section].values()]
            adjusted = holm([r.get('bootstrapP') if r.get('supported') else None for r in rows])
            for row, p in zip(rows, adjusted):
                row['holmP'] = p
    output = Path(args.output)
    output.write_text(json.dumps(report, separators=(',', ':'), allow_nan=False)+'\n')
    with output.with_suffix('.csv').open('w', newline='') as f:
        fields = ['panel', 'information', 'window', 'asset', 'horizon', 'entry', 'exit', 'zscore', 'actual', 'procedure', 'score', 'enter', 'model']
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n'); writer.writeheader()
        for panel in report['panels']:
            for target in panel['targets']:
                refs = {r['refitMonth'][:4]: r for r in target['refits']}
                for row in target['forecasts']:
                    for policy in POLICIES:
                        key = refs[row['entry'][:4]]['models'][policy]; model = panel['models'][key]
                        value = float(predict(model, row['x'])[0])
                        writer.writerow({'panel': panel['panel'], 'information': panel['information'], 'window': panel['window'],
                                         'asset': target['asset'], 'horizon': target['horizon'], 'entry': row['entry'], 'exit': row['exit'],
                                         'zscore': row['x'][4], 'actual': row['actual'], 'procedure': policy, 'score': value,
                                         'enter': bool(enters(value, model['threshold'])), 'model': key})
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
    parser.add_argument('--output', default=str(ROOT/'data/zscore-entry.json'))
    build(parser.parse_args())
