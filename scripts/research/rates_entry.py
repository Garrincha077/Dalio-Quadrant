"""Nested matched initial-yield and price-trend entry experiments.

Earlier macro and price studies remain frozen. See rates-entry-protocol.md.
"""
import argparse
import csv
import json
from pathlib import Path

import numpy as np
import pandas as pd
from extended_state import ROOT, digest
from learned_entry import MIN_TRAIN, HORIZONS, ages_at, enters, metrics, model_id
from zscore_entry import PriceDataset, folds_at, incremental
from entry_opportunities import episode_indices, holm

VERSION = 'rates-entry-1'
STAGES = ('base', 'rates', 'trend')
COHORTS = ('nominal', 'real')
BASE_NAMES = ['activity', 'inflation', 'deltaActivity', 'deltaInflation', 'priceZ36']


def monthly_values(observations, cutoff):
    result, seen = {}, set()
    for row in observations:
        date = row['date']
        month = pd.Period(date, freq='M')
        if month in seen or date[8:]!='01' or date>cutoff:
            raise ValueError('Yield observations must be unique monthly values before cutoff')
        seen.add(month)
        if row['value'] in (None, '.'):
            continue
        value = float(row['value'])
        if not np.isfinite(value):
            raise ValueError('Yield must be finite; negative real yields are valid')
        result[month] = value
    return result


class RateSource:
    def __init__(self, directory, as_of):
        self.directory = Path(directory)
        self.manifest = json.loads((self.directory/'manifest.json').read_text())
        if self.manifest['version']!='rate-vintages-1' or self.manifest['failures'] or self.manifest['asOf']!=as_of:
            raise ValueError('Need a complete yield collection with the exact revised cutoff')
        schedule_file = Path(__file__).with_name('state-vintage-schedule.json')
        if digest(schedule_file)!=self.manifest['scheduleSha256']:
            raise ValueError('Yield schedule hash mismatch')
        self.schedule = {pd.Period(r['entryMonth'], freq='M'): r['cutoff']
                         for r in json.loads(schedule_file.read_text())}
        self.raw, self.cache = {}, {}
        if {s['id'] for s in self.manifest['series']}!={'GS10', 'FII10'}:
            raise ValueError('Expected nominal and actual TIPS real yields')
        for source in self.manifest['series']:
            file = self.directory/(source['id']+'.json')
            if digest(file)!=source['sha256']:
                raise ValueError('Yield file differs from collection manifest')
            raw = json.loads(file.read_text())
            if raw['id']!=source['id'] or raw['revised']['cutoff']!=as_of:
                raise ValueError('Yield identity or revised cutoff mismatch')
            self.raw[source['id']] = raw

    def frame(self, refit, information, cohort):
        key = refit, information, cohort
        if key not in self.cache:
            cutoff = self.schedule.get(refit) if information=='vintage' else self.manifest['asOf']
            frames = {}
            for id in (['GS10'] if cohort=='nominal' else ['GS10', 'FII10']):
                raw = self.raw[id]
                snapshot = raw['snapshots'].get(cutoff) if information=='vintage' else raw['revised']
                if snapshot is None:
                    self.cache[key] = None
                    return None
                if snapshot['cutoff']!=cutoff:
                    raise ValueError('Yield snapshot cutoff mismatch')
                frames[id] = monthly_values(snapshot['observations'], cutoff)
            self.cache[key] = frames
        return self.cache[key]


def trailing_return(prices, entry):
    values = prices.reindex(pd.period_range(entry-13, entry-1, freq='M')).to_numpy(dtype=float)
    if len(values)!=13 or not np.isfinite(values).all() or (values<=0).any():
        return None
    return float(values[-1]/values[0]-1)


class MarketDataset(PriceDataset):
    def __init__(self, manifest, information, as_of, vintages, rates, cohort):
        super().__init__(manifest, information, as_of, vintages, 36)
        self.rates, self.cohort = rates, cohort
        self.feature_names = BASE_NAMES+['nominal10Y']+(['real10Y'] if cohort=='real' else [])+['trend12']
        self.input_count = len(self.feature_names)
        self.trends = {(a, m): trailing_return(self.prices[a], m) for a in self.assets for m in self.prices.index}

    def combined(self, macro, rates, entry, asset):
        base = super().joined(macro, entry, asset)
        trend = self.trends.get((asset, entry))
        if base is None or rates is None or trend is None:
            return None
        yields = [frame.get(entry-1) for frame in rates.values()]
        if any(v is None for v in yields):
            return None
        return np.array([*base, *yields, trend], dtype=float)

    def x(self, entry, asset):
        return self.combined(self.frame(entry), self.rates.frame(entry, self.information, self.cohort), entry, asset)

    def train(self, refit, horizon, asset):
        key = refit, horizon, asset
        if key not in self.prepared:
            macro, rates = self.frame(refit), self.rates.frame(refit, self.information, self.cohort)
            rows, xs, ys = [], [], []
            if macro is not None and rates is not None:
                for entry in self.prices.index:
                    if entry+horizon>=refit:
                        continue
                    x, y = self.combined(macro, rates, entry, asset), self.outcome(entry, horizon, asset)
                    if x is not None and y is not None:
                        rows.append(entry); xs.append(x); ys.append(y)
            self.prepared[key] = rows, np.array(xs).reshape((-1, self.input_count)), np.array(ys)
        return self.prepared[key]


def candidates(stage):
    return [{'id': f'{stage}:{penalty}:{half}', 'family': stage, 'penalty': penalty, 'halfLife': half}
            for penalty in (10, 100) for half in (0, 120)]


def expand(x, stage):
    x = np.asarray(x, dtype=float)
    return x[:, :5] if stage=='base' else x[:, :-1] if stage=='rates' else x


def predict(model, x):
    x = np.asarray(x, dtype=float).reshape((-1, model['inputCount']))
    if model['spec']['family']=='unconditional':
        return np.zeros(len(x))
    values = expand(np.clip(x, model['clipLow'], model['clipHigh']), model['spec']['family'])
    return ((values-model['means'])/model['scales'])@np.asarray(model['beta'])


def fit(x, y, ages, spec):
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    if x.ndim!=2 or len(y)<MIN_TRAIN or not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Need 60 finite matured training rows')
    half = spec.get('halfLife', 0)
    weights = np.exp(-np.log(2)*np.asarray(ages)/half) if half else np.ones(len(y))
    weights *= len(y)/weights.sum()
    baseline = float(np.average(y, weights=weights))
    model = {'spec': spec, 'inputCount': x.shape[1], 'baseline': baseline, 'n': len(y),
             'effectiveN': float(weights.sum()**2/(weights@weights))}
    if spec['family']=='unconditional':
        return {**model, 'threshold': 0., 'scorePercentiles': None}
    low, high = np.quantile(x, [.01, .99], axis=0)
    values = expand(np.clip(x, low, high), spec['family'])
    means = np.average(values, axis=0, weights=weights)
    scales = np.sqrt(np.average((values-means)**2, axis=0, weights=weights)); scales[scales<1e-12] = 1.
    z = (values-means)/scales
    beta = np.linalg.solve(z.T@(weights[:, None]*z)+spec['penalty']*np.eye(z.shape[1]), z.T@(weights*(y-baseline)))
    model.update({'clipLow': low.tolist(), 'clipHigh': high.tolist(), 'means': means.tolist(),
                  'scales': scales.tolist(), 'beta': beta.tolist()})
    scores = predict(model, x)
    model.update({'threshold': float(np.quantile(scores, .75)),
                  'scorePercentiles': np.quantile(scores, np.linspace(0, 1, 21)).tolist()})
    return model


def rank_score(model, value):
    q = model.get('scorePercentiles')
    if q is None or q[-1]-q[0]<=1e-12:
        return None
    ties = np.flatnonzero(np.abs(np.array(q)-value)<=1e-12)
    return float(np.mean(ties)*5) if len(ties) else float(np.interp(value, q, np.arange(0, 101, 5)))


def choose(dataset, refit, horizon, asset):
    folds = folds_at(dataset, refit, horizon, asset)
    n = sum(len(f[-1]) for f in folds)
    trace = {'folds': len(folds), 'nValidation': n, 'fallback': len(folds)<3 or n<24, 'candidates': []}
    if trace['fallback']:
        return {stage: candidates(stage)[2] for stage in STAGES}, trace
    trace['lastValidationExit'] = str(max(t[0]+horizon for f in folds for t in f[-1]))
    choices = {}
    for stage in STAGES:
        for spec in candidates(stage):
            values, masks, clock = [], [], []
            for origin, rows, x, y, targets in folds:
                model = fit(x, y, ages_at(rows, origin), spec)
                scores = predict(model, [t[1] for t in targets])
                values.extend(t[2] for t in targets); masks.extend(enters(scores, model['threshold']).tolist())
                clock.extend({'reference': str(t[0])} for t in targets)
            values, mask = np.array(values), np.array(masks, dtype=bool)
            trace['candidates'].append({'id': spec['id'], 'family': stage, 'n': len(values),
                'entryStarts': int(mask.sum()), 'entryEpisodes': len(episode_indices(clock, mask)),
                'entryLift': float(values[mask].mean()-values.mean()) if mask.any() else None})
        valid = [r for r in trace['candidates'] if r['family']==stage and r['entryStarts']>=12
                 and r['entryEpisodes']>=3 and r['entryLift'] is not None and r['entryLift']>0]
        winner = sorted(valid, key=lambda r: (-r['entryLift'], r['id']))[0]['id'] if valid else None
        choices[stage] = next((s for s in candidates(stage) if s['id']==winner), {'id': 'unconditional', 'family': 'unconditional'})
    return choices, trace


def compare(records, left, right, horizon, draws):
    paired = [{'entry': r['entry'], 'actual': r['actual'],
               'policies': {'macro': r['policies'][right], left: r['policies'][left]}} for r in records]
    return incremental(paired, left, horizon, draws)


def run(dataset, panel_name, draws):
    models, targets = {}, []
    for h in HORIZONS:
        for asset in dataset.assets:
            records, refits = [], []
            for year in range(1990 if panel_name=='long' else 2016, dataset.prices.index.max().year+1):
                refit = pd.Period(year=year, month=1, freq='M')
                rows, x, y = dataset.train(refit, h, asset)
                if len(y)<MIN_TRAIN:
                    continue
                choices, trace = choose(dataset, refit, h, asset); refs = {}
                for stage in STAGES:
                    model = fit(x, y, ages_at(rows, refit), choices[stage])
                    model.update({'refitMonth': str(refit), 'asset': asset, 'horizon': h, 'cohort': dataset.cohort,
                                  'information': dataset.information, 'vintageCutoff': dataset.vintage_cutoff(refit),
                                  'firstTrainingEntry': str(rows[0]), 'lastTrainingExit': str(rows[-1]+h)})
                    key = model_id(model); models[key] = model; refs[stage] = key
                before = len(records)
                for entry in pd.period_range(refit, refit+11, freq='M'):
                    tx, actual = dataset.x(entry, asset), dataset.outcome(entry, h, asset)
                    if tx is None or actual is None:
                        continue
                    policies = {}
                    for stage in STAGES:
                        model = models[refs[stage]]; value = float(predict(model, tx)[0])
                        policies[stage] = {'score': value, 'baseline': model['baseline'], 'enter': bool(enters(value, model['threshold']))}
                    records.append({'entry': str(entry), 'exit': str(entry+h), 'x': tx.tolist(), 'actual': actual, 'policies': policies})
                refits.append({'refitMonth': str(refit), 'models': refs, 'scoredEntries': len(records)-before, **trace})
            results = {p: metrics(records, p, h, draws) for p in STAGES}
            extra = {}
            for left, right in [('rates', 'base'), ('trend', 'rates'), ('trend', 'base')]:
                result = compare(records, left, right, h, draws)
                result.update({'left': left, 'right': right, 'supported': results[left].get('supported', False) and results[right].get('supported', False)})
                extra[left+'-'+right] = result
            targets.append({'asset': asset, 'horizon': h, 'results': results, 'incremental': extra, 'refits': refits,
                            'forecasts': [{k: r[k] for k in ('entry', 'exit', 'x', 'actual')} for r in records]})
            print(panel_name, dataset.information, dataset.cohort, asset, h, len(records), flush=True)
    return {'panel': panel_name, 'information': dataset.information, 'cohort': dataset.cohort,
            'priceStart': str(dataset.prices.index.min()), 'priceEnd': str(dataset.prices.index.max()),
            'features': dataset.feature_names, 'assets': dataset.metadata['assets'],
            'sourceHashes': {'manifest': digest(dataset.manifest), 'prices': digest(dataset.price_path),
                             'macroVintages': digest(dataset.vintage_dir/'manifest.json') if dataset.vintage_manifest else None},
            'models': models, 'targets': targets}


def build(args):
    rates = RateSource(args.rates, args.as_of)
    report = {'version': VERSION, 'asOf': args.as_of, 'horizons': list(HORIZONS), 'stages': list(STAGES),
              'cohorts': list(COHORTS), 'bootstrapDraws': args.draws, 'builderSha256': digest(__file__),
              'protocolSha256': digest(Path(__file__).with_name('rates-entry-protocol.md')),
              'dependencies': {p: digest(Path(__file__).with_name(p)) for p in ('learned_entry.py', 'zscore_entry.py', 'extended_state.py', 'entry_opportunities.py')},
              'stateSourceSha256': digest(ROOT/'data/state-forward.json'),
              'rateCollection': {**rates.manifest, 'manifestSha256': digest(Path(args.rates)/'manifest.json'),
                                 'sourceRun': 'https://github.com/Garrincha077/Dalio-Quadrant/actions/runs/40330298100'},
              'panels': [], 'limitations': ['Exploratory continuation of already inspected studies.',
                 'Real yields begin 2003; nominal and real cohorts have different training/evaluation histories.',
                 'Monthly Treasury yield features are not realised bond returns.',
                 'Long reconstructed bonds and monthly-average gold are not executable prices.',
                 'Historical score percentiles are within-asset training ranks, not probabilities or live recommendations.']}
    for info in args.information:
        for name, manifest in [('long', args.long_manifest), ('etf', args.etf_manifest)]:
            for cohort in COHORTS:
                dataset = MarketDataset(manifest, info, args.as_of, args.vintages, rates, cohort)
                report['panels'].append(run(dataset, name, args.draws))
    for info in args.information:
        for name in ('long', 'etf'):
            rows = [r for p in report['panels'] if p['information']==info and p['panel']==name
                    for t in p['targets'] for section in ('results', 'incremental') for r in t[section].values()]
            for row, p in zip(rows, holm([r.get('bootstrapP') if r.get('supported') else None for r in rows])):
                row['holmP'] = p
    output = Path(args.output); output.write_text(json.dumps(report, separators=(',', ':'), allow_nan=False)+'\n')
    with output.with_suffix('.csv').open('w', newline='') as f:
        fields = ['panel', 'information', 'cohort', 'asset', 'horizon', 'entry', 'exit', 'nominal10Y', 'real10Y', 'trend12', 'priceZ36', 'actual', 'stage', 'score', 'trainingRank', 'enter', 'model']
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n'); writer.writeheader()
        for panel in report['panels']:
            for target in panel['targets']:
                refs = {r['refitMonth'][:4]: r for r in target['refits']}
                for row in target['forecasts']:
                    for stage in STAGES:
                        key = refs[row['entry'][:4]]['models'][stage]; model = panel['models'][key]
                        value = float(predict(model, row['x'])[0])
                        writer.writerow({'panel': panel['panel'], 'information': panel['information'], 'cohort': panel['cohort'],
                          'asset': target['asset'], 'horizon': target['horizon'], 'entry': row['entry'], 'exit': row['exit'],
                          'nominal10Y': row['x'][5], 'real10Y': row['x'][6] if panel['cohort']=='real' else None,
                          'trend12': row['x'][-1], 'priceZ36': row['x'][4], 'actual': row['actual'], 'stage': stage,
                          'score': value, 'trainingRank': rank_score(model, value), 'enter': bool(enters(value, model['threshold'])), 'model': key})
    print('Wrote', output, flush=True)


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__); folder = ROOT/'work/research/extended'
    parser.add_argument('--long-manifest', default=str(folder/'long-manifest.json'))
    parser.add_argument('--etf-manifest', default=str(folder/'etf-manifest.json'))
    parser.add_argument('--vintages', default=str(ROOT/'work/research/state-vintages'))
    parser.add_argument('--rates', default=str(ROOT/'work/research/rate-vintages'))
    parser.add_argument('--information', nargs='+', choices=['revised', 'vintage'], default=['revised', 'vintage'])
    parser.add_argument('--as-of', default='2026-10-26'); parser.add_argument('--draws', type=int, default=5000)
    parser.add_argument('--output', default=str(ROOT/'data/rates-entry.json')); build(parser.parse_args())
