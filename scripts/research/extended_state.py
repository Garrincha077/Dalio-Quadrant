"""Versioned state/trend research; revised-history and vintage panels stay separate.

No network requests, fitted hyperparameters or provider price levels in public output.
See EXTENDED_STATE.md for the input contract and reproduction commands.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
VERSION = 'extended-state-1'
QUADRANTS = ('above-above', 'above-below', 'below-above', 'below-below', 'boundary')
LABELS = ('Above trend / PCE >2%', 'Above trend / PCE <2%',
          'Below trend / PCE >2%', 'Below trend / PCE <2%', 'On an anchor')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def month(value):
    return pd.Period(value, freq='M')


def classify(a, p):
    if a == 0 or p == 2:
        return 'boundary'
    return ('above' if a > 0 else 'below') + '-' + ('above' if p > 2 else 'below')


def direction(value, band):
    return 'rising' if value > band + 1e-9 else 'falling' if value < -band - 1e-9 else 'flat'


def shares(a, p):
    x, y = np.clip((a + .1) / .2, 0, 1), np.clip((p - 2 + .2) / .4, 0, 1)
    return np.array([x*y, x*(1-y), (1-x)*y, (1-x)*(1-y)], dtype=float)


def state_frame(points):
    rows = []
    seen = set()
    for p in points:
        m = month(p['month'])
        if m in seen:
            raise ValueError('Duplicate state month')
        seen.add(m)
        a, y = float(p['activity']), float(p['inflation'])
        if not np.isfinite([a, y]).all():
            raise ValueError('Nonfinite economic state')
        rows.append({'month': m, 'activity': a, 'inflation': y, 'quadrant': classify(a, y)})
    if not rows:
        raise ValueError('No economic states')
    return pd.DataFrame(rows).set_index('month').sort_index()


def trend_at(frame, reference):
    block = frame.reindex(pd.period_range(reference - 3, reference, freq='M'))
    if block[['activity', 'inflation']].isna().any().any():
        return None
    change = block.iloc[-1][['activity', 'inflation']] - block.iloc[0][['activity', 'inflation']]
    return direction(change.activity, .1) + '/' + direction(change.inflation, .2)


def describe_states(frame):
    counts = {q: {'months': 0, 'episodes': 0, 'longestRun': 0} for q in QUADRANTS}
    transitions = {q: {r: 0 for r in QUADRANTS} for q in QUADRANTS}
    previous, previous_month, run = None, None, 0
    for m, row in frame.iterrows():
        q = row.quadrant
        consecutive = previous_month is not None and m == previous_month + 1
        same = consecutive and q == previous
        run = run + 1 if same else 1
        counts[q]['months'] += 1
        counts[q]['episodes'] += int(not same)
        counts[q]['longestRun'] = max(counts[q]['longestRun'], run)
        if consecutive:
            transitions[previous][q] += 1
        previous, previous_month = q, m
    calendar = pd.period_range(frame.index.min(), frame.index.max(), freq='M')
    return {'first': str(frame.index.min()), 'last': str(frame.index.max()),
            'months': len(frame), 'missingMonths': [str(m) for m in calendar.difference(frame.index)],
            'quadrants': [{'key': q, 'label': label, **counts[q],
                           'share': counts[q]['months'] / len(frame)}
                          for q, label in zip(QUADRANTS, LABELS)], 'transitions': transitions,
            'basis': 'Revised reference-month states; not contemporaneous trading signals.'}


def revised_signals(frame, dates):
    result = {}
    for m, date in dates.items():
        reference = m - 2
        if reference not in frame.index:
            continue
        trend = trend_at(frame, reference)
        if trend is None:
            continue
        r = frame.loc[reference]
        result[m] = {'reference': str(reference), 'activity': float(r.activity),
                     'inflation': float(r.inflation), 'quadrant': r.quadrant,
                     'trend': trend, 'tradeDate': str(date), 'basis': 'revised-2m-delay'}
    return result


def vintage_signal(snapshot, trade_date):
    """A snapshot's exact prior-day information set; no fallback to revised history."""
    trade = pd.Timestamp(trade_date).normalize()
    cutoff = pd.Timestamp(snapshot['cutoff']).normalize()
    if cutoff != trade - pd.Timedelta(days=1) or trade < pd.Timestamp('2001-03-05'):
        raise ValueError('Vintage cutoff must be prior calendar day; no pre-launch CFNAI decisions')
    data = {}
    for series in ('CFNAIMA3', 'PCEPI'):
        points = snapshot['series'][series]['observations']
        out = {}
        for p in points:
            m = month(p['date'])
            if m in out:
                raise ValueError('Duplicate vintage month')
            if p['value'] not in ('.', None):
                value = float(p['value'])
                if not math.isfinite(value) or (series == 'PCEPI' and value <= 0):
                    raise ValueError('Invalid vintage value')
                out[m] = value
        data[series] = out
    activity, pce = data['CFNAIMA3'], data['PCEPI']
    completed = month(cutoff) - 1
    a = [m for m in activity if m <= completed]
    p = [m for m in pce if m <= completed and m - 12 in pce]
    # Match the latest available axis months; do not silently select an older common pair.
    if not a or not p or max(a) != max(p):
        return None
    reference = max(a)
    if (cutoff - reference.end_time.normalize()).days > 90:
        return None
    rows = []
    for m in pd.period_range(reference - 3, reference, freq='M'):
        if m not in activity or m not in pce or m - 12 not in pce:
            return None
        rows.append({'month': str(m), 'activity': activity[m],
                     'inflation': 100 * (pce[m] / pce[m-12] - 1)})
    frame = state_frame(rows)
    r = frame.loc[reference]
    return {'reference': str(reference), 'activity': float(r.activity), 'inflation': float(r.inflation),
            'quadrant': r.quadrant, 'trend': trend_at(frame, reference),
            'tradeDate': str(trade.date()), 'cutoff': str(cutoff.date()), 'basis': 'publication-vintage'}


def load_panel(manifest_path, as_of):
    manifest_path = Path(manifest_path)
    metadata = json.loads(manifest_path.read_text())
    assets = metadata['assets']
    if len(assets) not in (4, 5) or 'CASH' in assets:
        raise ValueError('Declare four or five distinct risky assets, excluding CASH')
    kinds = [item.get('assetClass') for item in assets.values()]
    if any(kinds) and kinds[:2] != ['equity', 'treasury']:
        raise ValueError('Fixed allocation controls require equity then Treasury columns')
    if 'inflation-linked' in kinds and metadata.get('sampleStart', '1997-01') < '1997-01':
        raise ValueError('No US TIPS history before 1997')
    for name, item in {**assets, 'CASH': metadata['cash']}.items():
        if not item.get('source') or not item.get('instrument') or item.get('currency') != 'USD':
            raise ValueError(f'Missing provenance or non-USD source: {name}')
        allowed = ('total-return', 'adjusted-close', 'spot-gold') if name != 'CASH' else ('total-return', 'yield-accrual-proxy')
        if item.get('returnType') not in allowed:
            raise ValueError(f'Unsupported return type: {name}; yields/spot commodity baskets are not total returns')
        if item.get('returnType') == 'spot-gold' and item.get('assetClass') != 'gold':
            raise ValueError('Spot prices allowed only for explicitly labelled gold')
    path = manifest_path.parent / metadata['prices']
    frame = pd.read_csv(path)
    dates = pd.to_datetime(frame.pop('date'), errors='raise')
    if (dates != dates.dt.normalize()).any():
        raise ValueError('Prices need dated daily closes, not intraday timestamps')
    frame.index = pd.PeriodIndex(dates, freq='M')
    if frame.index.duplicated().any():
        raise ValueError('Duplicate price months')
    frame = frame.reindex(columns=[*assets, 'CASH']).apply(pd.to_numeric, errors='raise').sort_index()
    date_map = dict(zip(pd.PeriodIndex(dates, freq='M'), dates.dt.strftime('%Y-%m-%d')))
    # Always exclude the unfinished as-of calendar month.
    frame = frame.loc[frame.index < month(as_of)]
    if len(frame) < 2 or not np.isfinite(frame.to_numpy()).all() or (frame <= 0).any().any():
        raise ValueError('Prices must be positive, finite and complete on a common calendar')
    if not frame.index.equals(pd.period_range(frame.index.min(), frame.index.max(), freq='M')):
        raise ValueError('Missing interior price months; do not bridge gaps')
    if 'inflation-linked' in kinds and frame.index.min() < month('1997-01'):
        raise ValueError('No US TIPS history before 1997')
    return frame, {m: date_map[m] for m in frame.index}, metadata, path


def matured_rows(signals, prices, decision, horizon=12):
    rows, starts, ends = [], [], []
    if not prices.index.is_monotonic_increasing or prices.index.duplicated().any():
        raise ValueError('Training prices require unique sorted months')
    positions = {m: i for i, m in enumerate(prices.index)}
    for m, signal in sorted(signals.items()):
        end = m + horizon
        # This month's exit close is still unknown before today's close.
        if m >= decision or end >= decision or m not in positions or end not in positions:
            continue
        if positions[end] - positions[m] != horizon:
            continue
        rows.append(signal)
        starts.append(positions[m])
        ends.append(positions[end])
    values = prices.to_numpy(dtype=float)
    outcomes = values[ends] / values[starts] - 1 if rows else np.empty((0, prices.shape[1]))
    return rows, outcomes


def ranking(signal, rows, outcomes, mode='state-trend'):
    if not len(rows):
        raise ValueError('No mature labels')
    n = len(rows)
    weights = np.zeros(n)
    if mode == 'unconditional':
        weights[:] = 1 / n
    else:
        groups = np.array([r['quadrant'] for r in rows])
        trends = np.array([r['trend'] for r in rows])
        for q, share in zip(QUADRANTS[:4], shares(signal['activity'], signal['inflation'])):
            parent, joint = groups == q, (groups == q) & (trends == signal['trend'])
            nq, nt = int(parent.sum()), int(joint.sum())
            alpha, beta = nq / (nq + 24), nt / (nt + 24)
            parent_weights = alpha * parent / max(nq, 1) + (1 - alpha) / n
            local = beta * joint / max(nt, 1) + (1 - beta) * parent_weights
            weights += share * (parent_weights if mode == 'state-only' else local)
    if not np.isclose(weights.sum(), 1):
        raise ValueError('Mixture weights must sum to one')
    return weights @ outcomes


def rebalance(values, weights, cost):
    """Self-financing allocation; fees apply to net risky buys/sells, cash is free."""
    values, weights = np.array(values, dtype=float), np.array(weights, dtype=float)
    if not 0 <= cost < .1 or np.min(values) < 0 or np.min(weights) < 0 or not np.isclose(weights.sum(), 1):
        raise ValueError('Invalid positions, target or cost')
    wealth = float(values.sum())
    lo, hi = 0., wealth
    for _ in range(60):
        net = (lo + hi) / 2
        residual = net + cost * np.abs(net * weights[:-1] - values[:-1]).sum() - wealth
        if residual > 0:
            hi = net
        else:
            lo = net
    net = (lo + hi) / 2
    turnover = float(np.abs(net * weights[:-1] - values[:-1]).sum())
    return weights * net, wealth - net, turnover


def simulate(prices, dates, signals, start, cost=.001, horizon=12, minimum=60):
    assets = list(prices.columns[:-1])
    n = len(assets)
    policies = ('state-trend', 'unconditional', 'state-only', 'equal-weight', 'equity', '60-40', 'cash')
    sleeves = {name: np.zeros((horizon, n + 1)) for name in policies[:3]}
    for panel in sleeves.values():
        panel[:, -1] = 1 / horizon
    static = {name: np.eye(1, n+1, n)[0] for name in policies[3:]}
    nav, records, audit = {name: [] for name in policies}, {name: [] for name in policies}, []
    decision_months = [m for m in prices.index[:-1] if m >= month(start)]
    if not decision_months:
        raise ValueError('No completed holding months after requested start')
    for i, m in enumerate(decision_months):
        signal = signals.get(m)
        rows, outcomes = matured_rows(signals, prices[assets], m, horizon)
        ready = signal is not None and len(rows) >= minimum
        factor = (prices.loc[m+1] / prices.loc[m]).to_numpy()
        choices = {}
        for name in policies:
            fee, turnover = 0., 0.
            if name in sleeves:
                panel = sleeves[name]
                before = float(panel.sum())
                target = np.zeros(n+1)
                means = ranking(signal, rows, outcomes, name) if ready else None
                order = sorted(range(n), key=lambda j: (-means[j], assets[j])) if ready else []
                chosen = order[0] if ready and means[order[0]] > 0 else n
                target[chosen] = 1
                slot = i % horizon
                panel[slot], fee, turnover = rebalance(panel[slot], target, cost)
                panel *= factor
                after = float(panel.sum())
                choices[name] = assets[chosen] if chosen < n else 'CASH'
            else:
                values = static[name]
                before = float(values.sum())
                target = np.zeros(n+1)
                ramp = min((i+1)/horizon, 1)
                if name == 'equal-weight':
                    target[:-1] = ramp / n
                elif name == 'equity':
                    target[0] = ramp
                elif name == '60-40':
                    target[0], target[1] = .6*ramp, .4*ramp
                target[-1] = 1 - target[:-1].sum()
                values, fee, turnover = rebalance(values, target, cost)
                static[name] = values * factor
                after = float(static[name].sum())
            ret = after / before - 1
            nav[name].append(after)
            records[name].append({'month': str(m+1), 'return': ret, 'costFraction': fee/before,
                                  'grossTradedFraction': turnover/before})
        audit.append({'decisionMonth': str(m), 'tradeDate': dates[m],
                      'reference': signal['reference'] if signal else None,
                      'trainingLabels': len(rows), 'lastTrainingExit': str(max((k+horizon for k in signals if k+horizon < m and k in prices.index and k+horizon in prices.index), default='')),
                      'choices': choices, 'status': 'ranked' if ready else 'cash-insufficient-training' if signal else 'cash-missing-signal'})
        if ready and m+horizon in prices.index:
            actual = (prices.loc[m+horizon, assets] / prices.loc[m, assets] - 1).to_numpy()
            selected = choices['state-trend']
            control = choices['unconditional']
            cash_return = float(prices.loc[m+horizon, 'CASH']/prices.loc[m, 'CASH']-1)
            realised = actual[assets.index(selected)] if selected != 'CASH' else cash_return
            baseline = actual[assets.index(control)] if control != 'CASH' else cash_return
            means = ranking(signal, rows, outcomes)
            rank_corr = pd.Series(means).rank().corr(pd.Series(actual).rank()) if np.std(means) > 0 and np.std(actual) > 0 else None
            audit[-1]['completed12M'] = {'exitMonth': str(m+horizon), 'selectedReturn': float(realised),
                                       'unconditionalReturn': float(baseline), 'equalWeightReturn': float(actual.mean()),
                                       'rankCorrelation': float(rank_corr) if rank_corr is not None else None,
                                       'basis': 'Gross source outcomes; portfolio costs reported separately.'}
    return records, audit


def performance(records, cash_returns):
    r = np.array([p['return'] for p in records])
    wealth = np.r_[1., np.cumprod(1+r)]
    excess = r - np.array(cash_returns)
    vol = float(r.std(ddof=1) * np.sqrt(12)) if len(r) > 1 else None
    sd = float(excess.std(ddof=1)) if len(r) > 1 else 0
    return {'months': len(r), 'cagr': float(wealth[-1] ** (12/len(r)) - 1),
            'volatility': vol, 'excessSharpe': float(excess.mean()/sd*np.sqrt(12)) if sd > 1e-12 else None,
            'monthlyMaxDrawdown': float(np.min(wealth / np.maximum.accumulate(wealth) - 1)),
            'totalCostFractions': float(sum(p['costFraction'] for p in records)),
            'annualGrossTradedFraction': float(sum(p['grossTradedFraction'] for p in records)*12/len(r))}


def paired_interval(a, b, block=12, draws=5000):
    delta = np.array(a) - np.array(b)
    n = len(delta)
    if n < 2 * block:
        return {'annualMeanDifference': float(delta.mean()*12), 'interval95': None, 'reason': 'Fewer than two blocks'}
    rng = np.random.default_rng(20261026)
    starts = rng.integers(0, n, size=(draws, math.ceil(n/block)))
    ix = ((starts[:, :, None] + np.arange(block)) % n).reshape(draws, -1)[:, :n]
    bounds = np.quantile(delta[ix].mean(axis=1)*12, [.025, .975])
    return {'annualMeanDifference': float(delta.mean()*12), 'interval95': bounds.tolist(),
            'blockMonths': block, 'draws': draws, 'seed': 20261026}


def build(args):
    source = Path(args.states)
    raw = json.loads(source.read_text())
    frame = state_frame(raw['points'])
    frame = frame.loc[frame.index < month(args.as_of)]
    protocol = Path(__file__).with_name('extended-state-protocol.md')
    report = {'version': VERSION, 'asOf': args.as_of,
              'builderSha256': digest(__file__),
              'protocolSha256': digest(protocol), 'stateSourceSha256': digest(source),
              'stateSourceAsOf': raw['asOf'], 'stateHistory': describe_states(frame),
              'targetLongHistory': {'start': '1973-01', 'evaluationStart': '1980-01',
                                   'status': 'awaiting-verified-index-data'},
              'returnStudy': {'status': 'not-run', 'reason': 'No verified price manifest supplied.'},
              'limitations': ['Revised states before CFNAI publication in March 2001 are descriptive reconstructions.',
                              'US TIPS did not exist before 1997; the long panel has four risky classes.',
                              'Index backcasts and ETF histories must remain separately identified.']}
    if args.manifest:
        prices, dates, metadata, price_path = load_panel(args.manifest, args.as_of)
        if args.gold_cost_bps:
            gold = [a for a, v in metadata['assets'].items() if v.get('assetClass') == 'gold']
            if len(gold) != 1:
                raise ValueError('Gold carrying cost requires exactly one gold asset')
            elapsed = np.arange(len(prices))/12
            prices[gold[0]] *= (1-args.gold_cost_bps/10000)**elapsed
        if args.mode == 'vintage':
            if metadata.get('executionBasis') != 'exchange-close':
                raise ValueError('Vintage trading requires documented exchange-close execution prices')
            if metadata['cash'].get('pointInTime') is False:
                raise ValueError('Revised yield accrual cannot be called a vintage cash model')
            if not args.vintages:
                raise ValueError('Vintage mode requires a snapshot directory')
            signals, hashes = {}, {}
            for m, date in dates.items():
                cutoff = str((pd.Timestamp(date)-pd.Timedelta(days=1)).date())
                path = Path(args.vintages) / (cutoff+'.json')
                if not path.exists():
                    continue
                signal = vintage_signal(json.loads(path.read_text()), date)
                hashes[path.name] = digest(path)
                if signal:
                    signals[m] = signal
            if not signals:
                raise ValueError('No usable publication-vintage signals; cannot substitute revised data')
            basis = 'publication-vintage'
        else:
            signals = revised_signals(frame, dates)
            hashes, basis = {}, 'revised-history-with-two-month-delay'
        start = args.start or ('1980-01' if len(metadata['assets']) == 4 else '2013-01')
        # Do not let a long initial all-cash period appear to be model performance.
        ready = [m for m in prices.index[:-1] if m >= month(start) and m in signals and
                 len(matured_rows(signals, prices.iloc[:, :-1], m)[0]) >= 60]
        if not ready:
            raise ValueError('No eligible evaluation start with 60 mature 12-month labels')
        actual_start = str(min(ready))
        cases = {}
        for bps in (0, 10, 25, 50):
            records, audit = simulate(prices, dates, signals, actual_start, bps/10000)
            cash = [p['return'] for p in records['cash']]
            cases[str(bps)] = {'results': {name: performance(rows, cash) for name, rows in records.items()},
                              'growthOf100': {name: np.r_[100., 100*np.cumprod([1+r['return'] for r in records[name]])].tolist()
                                              for name in ('state-trend', 'unconditional', 'equity')},
                              'comparison': paired_interval([p['return'] for p in records['state-trend']],
                                                            [p['return'] for p in records['unconditional']])}
            periods = [('1980-1989', '1980-01', '1989-12'), ('1990-1999', '1990-01', '1999-12'),
                       ('2000-2009', '2000-01', '2009-12'), ('2010-2019', '2010-01', '2019-12'),
                       ('2020-latest', '2020-01', '2099-12'), ('dot-com', '2000-01', '2002-12'),
                       ('financial-crisis', '2007-01', '2009-12'), ('pandemic', '2020-01', '2020-12'),
                       ('inflation-shock', '2022-01', '2022-12')]
            cases[str(bps)]['subperiods'] = {}
            for label, begin, end in periods:
                selected = {name: [r for r in rows if begin <= r['month'] <= end] for name, rows in records.items()}
                if selected['cash']:
                    cash_period = [r['return'] for r in selected['cash']]
                    cases[str(bps)]['subperiods'][label] = {name: performance(rows, cash_period) for name, rows in selected.items()}
            if bps == 10:
                primary, decisions = records, audit
        comparison24 = paired_interval([p['return'] for p in primary['state-trend']],
                                       [p['return'] for p in primary['unconditional']], block=24)
        report['returnStudy'] = {'status': 'complete', 'basis': basis,
                                'panelVersion': metadata.get('panelVersion', 'etf-revised-1'),
                                'executionBasis': metadata.get('executionBasis', 'exchange-close'),
                                'sourceLimitations': metadata.get('limitations', []),
                                'goldAnnualCostBps': args.gold_cost_bps,
                                'requestedStart': start, 'actualDecisionStart': actual_start,
                                'lastPriceMonth': str(prices.index.max()), 'priceMonths': len(prices),
                                'assets': metadata['assets'], 'cash': metadata['cash'],
                                'priceSha256': digest(price_path), 'manifestSha256': digest(args.manifest),
                                'snapshotHashes': hashes, 'costCases': cases,
                                'block24Sensitivity': comparison24,
                                'completed12MCount': sum('completed12M' in d for d in decisions),
                                'selectedCashDecisions': sum(d['choices']['state-trend'] == 'CASH' for d in decisions),
                                'decisions': decisions, 'monthlyPortfolios': primary,
                                'evidence': 'Retrospective research; no confirmed prospective edge.',
                                'missingSignals': sum(m not in signals for m in prices.index),
                                'valuation': 'Monthly close to close; costs at entry; open holdings marked at final close.',
                                'baselineRamp': 'Fixed allocation controls ramp risk over the same first 12 decision months.'}
        if args.panel == 'long':
            if len(metadata['assets']) != 4:
                raise ValueError('Long panel requires a fixed four-asset universe')
            if {v.get('assetClass') for v in metadata['assets'].values()} != {'equity', 'treasury', 'gold', 'commodities'}:
                raise ValueError('Long panel requires equity, Treasuries, gold and broad commodities')
            report['targetLongHistory']['status'] = 'complete' if prices.index.min() <= month('1973-01') and prices.index.max() >= month('2026-09') else 'partial-coverage'
            report['targetLongHistory']['actualPriceStart'] = str(prices.index.min())
            report['targetLongHistory']['actualPriceEnd'] = str(prices.index.max())
            report['targetLongHistory']['reason'] = 'Public proxy study; full target-period verified index and vintage panels remain separate.'
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'output': str(out), 'stateMonths': len(frame),
                      'returns': report['returnStudy']['status'], 'longHistory': report['targetLongHistory']['status']}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--states', default=str(ROOT/'data/state-forward.json'))
    parser.add_argument('--as-of', default='2026-10-26')
    parser.add_argument('--manifest')
    parser.add_argument('--mode', choices=['revised', 'vintage'], default='revised')
    parser.add_argument('--panel', choices=['etf', 'long'], default='etf')
    parser.add_argument('--vintages')
    parser.add_argument('--start')
    parser.add_argument('--gold-cost-bps', type=int, choices=[0, 25, 50], default=0)
    parser.add_argument('--output', default=str(ROOT/'data/extended-state.json'))
    args = parser.parse_args()
    build(args)


if __name__ == '__main__':
    main()
