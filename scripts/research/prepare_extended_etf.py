"""Normalize privately obtained adjusted ETF CSVs and a FRED TB3MS CSV.

The cash carry uses a two-reference-month-delayed, revised monthly yield and is
therefore only suitable for the explicitly revised-history ETF panel.
"""
import argparse
import json
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def prepare(price_dir, cash_path, output, as_of):
    assets = {'SPY': ('US equities', 'equity'), 'IEF': ('7–10Y Treasuries', 'treasury'),
              'GLD': ('Gold ETF', 'gold'), 'TIP': ('Inflation-linked bonds', 'inflation-linked'),
              'DBC': ('Broad commodities ETF', 'commodities')}
    series, date_sets = {}, []
    for asset in assets:
        raw = pd.read_csv(price_dir/f'{asset}.csv')
        dates = pd.to_datetime(raw['timestamp'])
        ix = pd.PeriodIndex(dates, freq='M')
        if ix.duplicated().any():
            raise ValueError('Duplicate price month: '+asset)
        series[asset] = pd.Series(pd.to_numeric(raw['adjusted close']).to_numpy(), index=ix).sort_index()
        date_sets.append(dict(zip(ix, dates.dt.strftime('%Y-%m-%d'))))
    frame = pd.DataFrame(series).dropna()
    frame = frame.loc[frame.index < pd.Period(as_of, freq='M')]
    if not len(frame) or not frame.index.equals(pd.period_range(frame.index.min(), frame.index.max(), freq='M')):
        raise ValueError('Common ETF history is empty or has gaps')
    cash = pd.read_csv(cash_path)
    yields = pd.Series(pd.to_numeric(cash['TB3MS'], errors='coerce').to_numpy(),
                       index=pd.PeriodIndex(cash['observation_date'], freq='M'))
    if yields.index.duplicated().any():
        raise ValueError('Duplicate cash month')
    value, cash_levels = 100., []
    for i, m in enumerate(frame.index):
        if len({dates[m] for dates in date_sets}) != 1:
            raise ValueError('Mismatched ETF execution dates')
        if i:
            previous = frame.index[i-1]
            y = yields.get(previous-2)
            if y is None or not np.isfinite(y) or 1+y/100 <= 0:
                raise ValueError('Missing delayed cash yield')
            days = (pd.Timestamp(date_sets[0][m])-pd.Timestamp(date_sets[0][previous])).days
            value *= (1+y/100)**(days/365.25)
        cash_levels.append(value)
    frame['CASH'] = cash_levels
    frame.insert(0, 'date', [date_sets[0][m] for m in frame.index])
    output.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output/'etf-prices.csv', index=False)
    metadata = {'prices': 'etf-prices.csv', 'assets': {
        asset: {'instrument': name, 'assetClass': kind, 'currency': 'USD',
                'returnType': 'adjusted-close',
                'source': 'Alpha Vantage TIME_SERIES_MONTHLY_ADJUSTED',
                'sourceFileSha256': __import__('hashlib').sha256((price_dir/f'{asset}.csv').read_bytes()).hexdigest()}
        for asset, (name, kind) in assets.items()},
        'cash': {'instrument': 'Two-month-delayed revised TB3MS yield accrual proxy',
                 'currency': 'USD', 'returnType': 'yield-accrual-proxy',
                 'source': 'https://fred.stlouisfed.org/series/TB3MS',
                 'sourceFileSha256': __import__('hashlib').sha256(cash_path.read_bytes()).hexdigest(),
                 'pointInTime': False, 'dayCount': 'actual/365.25', 'referenceLagMonths': 2}}
    (output/'etf-manifest.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print(f'Prepared {len(frame)} common ETF months: {frame.index.min()}–{frame.index.max()}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prices', type=Path, default=ROOT/'work/research/prices')
    parser.add_argument('--cash', type=Path, default=ROOT/'work/research/extended/TB3MS.csv')
    parser.add_argument('--output', type=Path, default=ROOT/'work/research/extended')
    parser.add_argument('--as-of', default='2026-10-26')
    args = parser.parse_args()
    prepare(args.prices, args.cash, args.output, args.as_of)
