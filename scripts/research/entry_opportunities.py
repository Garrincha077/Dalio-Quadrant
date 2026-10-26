"""Conditional entry returns relative to each asset's own eligible baseline.

Read entry-opportunities-protocol.md before changing fixed categories or rankings.
This exploratory study does not fit the dashboard axes to asset returns.
"""
import argparse
import csv
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from extended_state import ROOT, digest, load_panel

VERSION = 'entry-opportunities-1'
EPS = 1e-9
HORIZONS = (3, 12, 36)
FAMILIES = ('state', 'state-trend', 'state-trend-distance')
MIN_STARTS, MIN_EPISODES = 24, 6
SEED = 20261026


def quadrant(activity, inflation):
    if not np.isfinite([activity, inflation]).all():
        return None
    if abs(activity) <= EPS or abs(inflation-2) <= EPS:
        return 'boundary'
    return ('above' if activity > 0 else 'below')+'-'+('above' if inflation > 2 else 'below')


def direction(change, band):
    return 'rising' if change > band+EPS else 'falling' if change < -band-EPS else 'flat'


def distance(value, near, outer):
    return 'near' if abs(value) <= near+EPS else 'intermediate' if abs(value) <= outer+EPS else 'distant'


def conditions(points):
    lookup = {}
    for row in points:
        m = pd.Period(row['month'], freq='M')
        if m in lookup:
            raise ValueError('Duplicate economic state')
        if not np.isfinite([row['activity'], row['inflation']]).all():
            continue
        lookup[m] = row
    result, flips = {}, []
    for m, row in sorted(lookup.items()):
        q = quadrant(row['activity'], row['inflation'])
        if row.get('quadrant', q) != q:
            flips.append(str(m))
        block = [lookup.get(m-i) for i in range(3, -1, -1)]
        if any(r is None for r in block):
            continue
        a, p = row['activity'], row['inflation']
        trend = direction(a-block[0]['activity'], .1)+'/'+direction(p-block[0]['inflation'], .2)
        strength = distance(a, .1, .5)+'/'+distance(p-2, .2, 2)
        result[m] = {'state': q, 'trend': trend, 'distance': strength,
                     'nearBoundary': abs(a) <= .1+EPS or abs(p-2) <= .2+EPS,
                     'activity': a, 'inflation': p}
    return result, flips


def cohort(prices, features, horizon):
    records, returns = [], []
    locations = {m: i for i, m in enumerate(prices.index)}
    risky = prices.iloc[:, :-1].to_numpy(dtype=float)
    for reference, row in sorted(features.items()):
        entry, exit_month = reference+2, reference+2+horizon
        if entry not in locations or exit_month not in locations:
            continue
        if locations[exit_month]-locations[entry] != horizon:
            continue
        records.append({'reference': str(reference), 'entry': str(entry), 'exit': str(exit_month), **row})
        returns.append(risky[locations[exit_month]]/risky[locations[entry]]-1)
    return records, np.array(returns, dtype=float).reshape((-1, risky.shape[1]))


def cell_key(row, family):
    if family == 'state':
        return row['state']
    if family == 'state-trend':
        return row['state']+'|'+row['trend']
    return row['state']+'|'+row['trend']+'|'+row['distance']


def episode_indices(records, selected):
    groups, previous = [], None
    for i in np.flatnonzero(selected):
        date = pd.Period(records[i]['reference'], freq='M')
        if previous is None or date != previous+1:
            groups.append([])
        groups[-1].append(int(i))
        previous = date
    return groups


def nonoverlap_count(records, selected, horizon):
    last, count = None, 0
    for i in np.flatnonzero(selected):
        start = pd.Period(records[i]['entry'], freq='M')
        if last is None or start >= last+horizon:
            count += 1
            last = start
    return count


def summarize_cell(records, values, selected, horizon):
    part = values[selected]
    if not len(part):
        return None
    baseline = float(values.mean())
    groups = episode_indices(records, selected)
    era = np.array([int(r['entry'][:4])//10 for r in records])
    matched = sum(float(np.mean(era[selected] == decade))*float(values[era == decade].mean())
                  for decade in np.unique(era[selected]))
    removed = []
    for group in groups:
        keep = np.ones(len(records), dtype=bool)
        keep[group] = False
        if (selected & keep).any():
            removed.append(float(values[selected & keep].mean()-values[keep].mean()))
    outside = selected & np.array([not r['nearBoundary'] for r in records])
    unrestricted_outside = np.array([not r['nearBoundary'] for r in records])
    return {'n': len(part), 'episodes': len(groups),
            'nonoverlappingStarts': nonoverlap_count(records, selected, horizon),
            'firstEntry': next(r['entry'] for r, good in zip(records, selected) if good),
            'lastEntry': next(r['entry'] for r, good in zip(reversed(records), reversed(selected)) if good),
            'mean': float(part.mean()), 'baseline': baseline, 'lift': float(part.mean()-baseline),
            'median': float(np.median(part)), 'baselineMedian': float(np.median(values)),
            'p10': float(np.quantile(part, .1)), 'lossFrequency': float((part < 0).mean()),
            'decadeMatchedBaseline': float(matched), 'decadeMatchedLift': float(part.mean()-matched),
            'largestEpisodeShare': max(map(len, groups))/len(part),
            'worstLiftWithoutOneEpisode': min(removed) if removed else None,
            'outsideBufferN': int(outside.sum()),
            'outsideBufferLift': float(values[outside].mean()-values[unrestricted_outside].mean()) if outside.any() else None,
            'supported': len(part) >= MIN_STARTS and len(groups) >= MIN_EPISODES}


def bootstrap(records, returns, masks, horizon, draws=5000):
    """Resample shared calendar blocks; use the same rows for condition and baseline."""
    n, assets = returns.shape
    if not n or not masks.shape[1]:
        return {}
    # Keep missing clock months as gaps instead of concatenating non-adjacent dates.
    first = pd.Period(records[0]['entry'], freq='M')
    last = pd.Period(records[-1]['entry'], freq='M')
    length = last.ordinal-first.ordinal+1
    positions = np.array([pd.Period(r['entry'], freq='M').ordinal-first.ordinal for r in records])
    block = max(12, horizon)
    rng = np.random.default_rng(SEED+horizon)
    starts = rng.integers(0, length, size=(draws, math.ceil(length/block)))
    ix = ((starts[:, :, None]+np.arange(block)) % length).reshape(draws, -1)[:, :length]
    frequency = np.array([np.bincount(row, minlength=length)[positions] for row in ix], dtype=float)
    denominator = frequency@masks
    total = frequency.sum(axis=1)
    observed = np.array([(returns[masks[:, j].astype(bool)].mean(axis=0)-returns.mean(axis=0))
                         for j in range(masks.shape[1])])
    result = {}
    for a in range(assets):
        global_mean = np.divide(frequency@returns[:, a], total, out=np.full(draws, np.nan), where=total > 0)
        sums = frequency@(masks*returns[:, a, None])
        local = np.divide(sums, denominator, out=np.full(sums.shape, np.nan), where=denominator > 0)
        deltas = local-global_mean[:, None]
        for j in range(masks.shape[1]):
            values = deltas[:, j]
            values = values[np.isfinite(values)]
            good = len(values) >= .8*draws
            p = float((1+np.sum(np.abs(values-observed[j, a]) >= abs(observed[j, a])-1e-14))/(1+len(values))) if good else None
            result[a, j] = {'liftCI95': np.quantile(values, [.025, .975]).tolist() if good else None,
                            'bootstrapP': p, 'validDraws': len(values), 'blockMonths': block}
    return result


def holm(values):
    """Holm adjusted p-values in original order, preserving unavailable tests."""
    good = sorted((v, i) for i, v in enumerate(values) if v is not None)
    out, current = [None]*len(values), 0.
    for rank, (value, i) in enumerate(good):
        current = max(current, (len(good)-rank)*value)
        out[i] = min(1., current)
    return out


def select_temporal(records, values, family, split):
    # Complete outcome strictly before split; crossing labels are purged.
    development = np.array([r['exit'] < split for r in records])
    later = np.array([r['entry'] >= split for r in records])
    keys = np.array([cell_key(r, family) for r in records])
    candidates = []
    dev_records = [r for r, keep in zip(records, development) if keep]
    for key in sorted(set(keys[development])):
        if key.split('|')[0] == 'boundary':
            continue
        selected = keys[development] == key
        groups = episode_indices(dev_records, selected)
        if selected.sum() >= MIN_STARTS and len(groups) >= MIN_EPISODES:
            candidates.append((float(values[development][selected].mean()-values[development].mean()), key))
    if not candidates:
        return {'condition': None, 'reason': 'No development condition meets 24 starts / six episodes.',
                'developmentN': int(development.sum()), 'laterN': int(later.sum()), 'split': split}
    lift, key = sorted(candidates, key=lambda item: (-item[0], item[1]))[0]
    selected = later & (keys == key)
    result = {'condition': key, 'developmentLift': lift,
              'developmentN': int(development.sum()), 'developmentConditionN': int((development & (keys == key)).sum()),
              'lastDevelopmentExit': max(r['exit'] for r, keep in zip(records, development) if keep),
              'laterN': int(later.sum()), 'laterConditionN': int(selected.sum()), 'split': split,
              'laterMean': float(values[selected].mean()) if selected.any() else None,
              'laterBaseline': float(values[later].mean()) if later.any() else None,
              'laterLift': float(values[selected].mean()-values[later].mean()) if selected.any() else None,
              'laterEpisodes': len(episode_indices(records, selected)),
              'basis': 'Retrospective temporal check; previously researched periods, not untouched holdout.'}
    return result


def analyse_panel(manifest, raw_states, as_of, name, draws):
    prices, dates, metadata, source = load_panel(manifest, as_of)
    features, flips = conditions(raw_states['points'])
    assets = list(metadata['assets'])
    cells, cohorts, temporal, cohort_cache = [], {}, [], {}
    for h in HORIZONS:
        records, gross = cohort(prices, features, h)
        if not records:
            continue
        net = (1+gross)*.999/1.001-1
        cohort_cache[h] = (records, net)
        descriptors = [(family, key) for family in FAMILIES for key in sorted({cell_key(r, family) for r in records})]
        masks = np.array([[cell_key(r, family) == key for family, key in descriptors] for r in records], dtype=float)
        boot = bootstrap(records, net, masks, h, draws)
        cohorts[str(h)] = {'n': len(records), 'firstEntry': records[0]['entry'], 'lastEntry': records[-1]['entry'],
                           'lastExit': max(r['exit'] for r in records),
                           'baseline': {a: float(net[:, j].mean()) for j, a in enumerate(assets)},
                           'conditionCount': len(descriptors), 'candidateComparisons': len(descriptors)*len(assets)}
        for j, asset in enumerate(assets):
            for k, (family, key) in enumerate(descriptors):
                mask = masks[:, k].astype(bool)
                s = summarize_cell(records, net[:, j], mask, h)
                stress = (1+gross[:, j])*.9975/1.0025-1
                cell = {'id': f'{name}:{h}:{asset}:{family}:{key}', 'asset': asset, 'horizon': h,
                        'family': family, 'condition': key, **s, **boot[j, k],
                        'stress25bpMean': float(stress[mask].mean()),
                        'stress25bpLift': float(stress[mask].mean()-stress.mean())}
                cells.append(cell)
            for family in FAMILIES:
                temporal.append({'asset': asset, 'horizon': h, 'family': family,
                                 **select_temporal(records, net[:, j], family, '2000-01' if name == 'long' else '2016-01')})
    adjusted = holm([c['bootstrapP'] if c['supported'] else None for c in cells])
    for c, p in zip(cells, adjusted):
        c['holmP'] = p
        c['exploratoryAdjustedPositive'] = bool(p is not None and p < .05 and c['lift'] > 0)
    winners = []
    for h in HORIZONS:
        for asset in assets:
            for family in FAMILIES:
                group = sorted((c for c in cells if c['horizon'] == h and c['asset'] == asset and c['family'] == family and c['condition'].split('|')[0] != 'boundary'),
                               key=lambda c: (-c['lift'], c['condition']))
                supported = [c for c in group if c['supported']]
                winners.append({'asset': asset, 'horizon': h, 'family': family,
                                'rawMaximum': group[0]['id'] if group else None,
                                'supportedMaximum': supported[0]['id'] if supported else None})
    episode_ranges = {}
    wanted = {w[key] for w in winners for key in ('rawMaximum', 'supportedMaximum') if w[key]}
    for c in cells:
        if c['id'] not in wanted:
            continue
        records, net = cohort_cache[c['horizon']]
        selected = np.array([cell_key(r, c['family']) == c['condition'] for r in records])
        a = assets.index(c['asset'])
        episode_ranges[c['id']] = [{'firstReference': records[g[0]]['reference'],
                                   'lastReference': records[g[-1]]['reference'],
                                   'firstEntry': records[g[0]]['entry'], 'lastEntry': records[g[-1]]['entry'],
                                   'starts': len(g), 'meanReturn': float(net[g, a].mean())}
                                  for g in episode_indices(records, selected)]
    return {'name': name, 'panelVersion': metadata.get('panelVersion', 'etf-revised-1'),
            'priceStart': str(prices.index.min()), 'priceEnd': str(prices.index.max()),
            'assets': metadata['assets'], 'sourceLimitations': metadata.get('limitations', []),
            'sourceHashes': {'manifest': digest(manifest), 'prices': digest(source)},
            'classificationChangesFromTolerance': flips, 'cohorts': cohorts, 'cells': cells,
            'comparisons': len(cells), 'supportedComparisons': sum(c['supported'] for c in cells),
            'winners': winners, 'temporal': temporal, 'leadingEpisodes': episode_ranges,
            'basis': 'Latest-revised macro pairs; two-month entry delay; no publication-vintage evidence.'}


def overlap_check(long_manifest, etf_manifest, points, as_of):
    features, _ = conditions(points)
    long, _, _, _ = load_panel(long_manifest, as_of)
    etf, _, _, _ = load_panel(etf_manifest, as_of)
    pairs = [('EQUITY', 'SPY'), ('TREASURY', 'IEF'), ('GOLD', 'GLD'), ('COMMODITIES', 'DBC')]
    rows = []
    for h in HORIZONS:
        lr, ly = cohort(long, features, h)
        er, ey = cohort(etf, features, h)
        shared = sorted({r['entry'] for r in lr} & {r['entry'] for r in er})
        lm = {r['entry']: i for i, r in enumerate(lr)}
        em = {r['entry']: i for i, r in enumerate(er)}
        for la, ea in pairs:
            lv = np.array([ly[lm[m], list(long.columns[:-1]).index(la)] for m in shared])
            ev = np.array([ey[em[m], list(etf.columns[:-1]).index(ea)] for m in shared])
            lv, ev = (1+lv)*.999/1.001-1, (1+ev)*.999/1.001-1
            states = np.array([lr[lm[m]]['state'] for m in shared])
            local = []
            for q in sorted(set(states)):
                selected = states == q
                local.append({'state': q, 'n': int(selected.sum()),
                              'longLift': float(lv[selected].mean()-lv.mean()),
                              'etfLift': float(ev[selected].mean()-ev.mean())})
            rows.append({'horizon': h, 'longAsset': la, 'etfAsset': ea, 'n': len(shared),
                         'firstEntry': shared[0], 'lastEntry': shared[-1], 'states': local})
    return rows


def build(args):
    raw = json.loads(Path(args.states).read_text())
    report = {'version': VERSION, 'asOf': args.as_of, 'builderSha256': digest(__file__),
              'protocolSha256': digest(Path(__file__).with_name('entry-opportunities-protocol.md')),
              'statesSha256': digest(args.states), 'stateSourceAsOf': raw['asOf'],
              'horizons': list(HORIZONS), 'families': list(FAMILIES),
              'method': {'entryLagMonths': 2, 'minStarts': MIN_STARTS, 'minEpisodes': MIN_EPISODES,
                         'primaryCostPerSideBps': 10, 'stressCostPerSideBps': 25,
                         'rankBy': 'conditional mean minus same-asset same-cohort unconditional mean',
                         'intervals': 'Unadjusted paired circular moving-block 95% intervals',
                         'multipleTesting': 'Holm across all supported asset/horizon/condition tests within each panel',
                         'bootstrapDraws': args.draws, 'seed': SEED,
                         'distanceActivity': [.1, .5], 'distanceInflationGap': [.2, 2.]},
              'panels': [analyse_panel(args.long_manifest, raw, args.as_of, 'long', args.draws),
                         analyse_panel(args.etf_manifest, raw, args.as_of, 'etf', args.draws)]}
    report['sameDateProxyCheck'] = overlap_check(args.long_manifest, args.etf_manifest, raw['points'], args.as_of)
    out = Path(args.output)
    out.write_text(json.dumps(report, separators=(',', ':'), allow_nan=False)+'\n')
    rows = [{'panel': p['name'], **c} for p in report['panels'] for c in p['cells']]
    with out.with_suffix('.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        for row in rows:
            writer.writerow({k: json.dumps(v) if isinstance(v, (list, dict)) else v for k, v in row.items()})
    print(json.dumps({'output': str(out), 'panels': [{k: p[k] for k in ('name', 'comparisons', 'supportedComparisons')} for p in report['panels']]}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    folder = ROOT/'work/research/extended'
    parser.add_argument('--long-manifest', default=str(folder/'long-manifest.json'))
    parser.add_argument('--etf-manifest', default=str(folder/'etf-manifest.json'))
    parser.add_argument('--states', default=str(ROOT/'data/state-forward.json'))
    parser.add_argument('--as-of', default='2026-10-26')
    parser.add_argument('--draws', type=int, default=5000)
    parser.add_argument('--output', default=str(ROOT/'data/entry-opportunities.json'))
    build(parser.parse_args())
