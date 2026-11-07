"""Prepare long-public-proxy-1, not a tradable pre-ETF performance history.

Inputs: publisher AQR workbook, publisher Shiller workbook, French factor archive,
and World Bank monthly gold via the attributed datasets/gold-prices mirror.
No estimates are fitted to portfolio performance. Raw files remain private.
"""
import argparse
import io
import json
import re
import zipfile
from pathlib import Path
import numpy as np
import pandas as pd
from extended_state import digest

ROOT = Path(__file__).resolve().parents[2]


def french(path):
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('.csv'))
        text = z.read(name).decode('utf-8-sig')
    lines = [line for line in text.splitlines() if re.match(r'^\s*\d{6},', line)]
    frame = pd.read_csv(io.StringIO('month,Mkt-RF,SMB,HML,RF\n'+'\n'.join(lines)), dtype={'month': str})
    frame.index = pd.PeriodIndex(frame.pop('month'), freq='M')
    if frame.index.duplicated().any():
        raise ValueError('Duplicate French month')
    return frame.apply(pd.to_numeric) / 100


def prepare(folder, as_of):
    factors = french(folder/'french-factors.zip')
    stock = (1+factors['Mkt-RF']+factors['RF']).cumprod()
    cash = (1+factors['RF']).cumprod()
    shiller = pd.read_excel(folder/'shiller.xls', sheet_name='Data', header=None)
    # Check the multi-row headers before reading the published nominalisable bond INDEX.
    if str(shiller.iloc[6,18]).strip() != 'Bond' or str(shiller.iloc[7,4]).strip() != 'CPI':
        raise ValueError('Shiller header layout changed')
    rows = []
    for _, r in shiller.iloc[8:].iterrows():
        try:
            value = float(r.iloc[0])
            year, m = int(value), round((value-int(value))*100)
            cpi, real_bond = float(r.iloc[4]), float(r.iloc[18])
        except (TypeError, ValueError):
            continue
        if 1 <= m <= 12 and np.isfinite([cpi, real_bond]).all():
            rows.append((pd.Period(year=year, month=m, freq='M'), cpi*real_bond))
    bond = pd.Series(dict(rows)).sort_index()
    if len(bond) != len(rows):
        raise ValueError('Duplicate Shiller month')
    gold_raw = pd.read_csv(folder/'worldbank-gold.csv')
    gold = pd.Series(pd.to_numeric(gold_raw['Price']).to_numpy(), index=pd.PeriodIndex(gold_raw['Date'], freq='M'))
    aqr = pd.read_excel(folder/'aqr-commodities.xlsx', sheet_name='Commodities for the Long Run', header=10)
    column = 'Excess return of equal-weight commodities portfolio'
    if column not in aqr:
        raise ValueError('AQR header layout changed')
    excess = pd.Series(pd.to_numeric(aqr[column], errors='raise').to_numpy(),
                       index=pd.PeriodIndex(pd.to_datetime(aqr.iloc[:,0]), freq='M'))
    if excess.index.duplicated().any() or gold.index.duplicated().any():
        raise ValueError('Duplicate AQR/gold month')
    total = excess + factors['RF'].reindex(excess.index)
    # Futures P&L on fully collateralised capital plus the T-bill collateral return.
    commodities = (1+total.dropna()).cumprod()
    frame = pd.DataFrame({'EQUITY': stock, 'TREASURY': bond, 'GOLD': gold,
                          'COMMODITIES': commodities, 'CASH': cash})
    frame = frame.loc[(frame.index >= pd.Period('1973-01', freq='M')) &
                      (frame.index < pd.Period(as_of, freq='M'))].dropna()
    if not len(frame) or not frame.index.equals(pd.period_range(frame.index.min(), frame.index.max(), freq='M')):
        raise ValueError('Missing common months in long panel')
    if not np.isfinite(frame.to_numpy()).all() or (frame <= 0).any().any():
        raise ValueError('Invalid normalised levels')
    frame.insert(0, 'date', [str(m.end_time.date()) for m in frame.index])
    frame.to_csv(folder/'long-prices.csv', index=False)
    def source(name, kind, return_type, url, filename, **extra):
        return {'instrument': name, 'assetClass': kind, 'returnType': return_type,
                'currency': 'USD', 'source': url, 'sourceFileSha256': digest(folder/filename), **extra}
    metadata = {'prices': 'long-prices.csv', 'panelVersion': 'long-public-proxy-1',
                'executionBasis': 'monthly-proxies-not-executable-closes',
                'assets': {
        'EQUITY': source('French broad US market: Mkt-RF + RF', 'equity', 'total-return',
                         'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html', 'french-factors.zip'),
        'TREASURY': source('Shiller reconstructed nominal bond index: real bond index × CPI', 'treasury', 'total-return',
                           'https://shillerdata.com/', 'shiller.xls', reconstructed=True,
                           note='Publisher model based on monthly rates; not an observed IEF-equivalent index.'),
        'GOLD': source('World Bank monthly average USD gold; attributed public mirror', 'gold', 'spot-gold',
                       'https://github.com/datasets/gold-prices', 'worldbank-gold.csv',
                       originalSource='https://www.worldbank.org/en/research/commodity-markets', priceBasis='monthly-average'),
        'COMMODITIES': source('AQR equal-weight commodity futures excess return + French RF collateral', 'commodities', 'total-return',
                              'https://www.aqr.com/Insights/Datasets/Commodities-for-the-Long-Run-Index-Level-Data-Monthly',
                              'aqr-commodities.xlsx', backcast=True,
                              note='Research reconstruction; different universe/weights from GSCI and DBC.')},
        'cash': source('French realised monthly T-bill return', 'cash', 'total-return',
                       'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html', 'french-factors.zip'),
        'limitations': ['Monthly proxy observations are not all executable month-end closes.',
                        'Revised economic states and reconstructed indices introduce hindsight bias.',
                        'Common sample stops at AQR cutoff; no splice extends it to 2026.']}
    (folder/'long-manifest.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print(f'Prepared {len(frame)} long proxy months: {frame.index.min()}–{frame.index.max()}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', type=Path, default=ROOT/'work/research/extended')
    parser.add_argument('--as-of', default='2026-10-26')
    args = parser.parse_args()
    prepare(args.folder, args.as_of)
