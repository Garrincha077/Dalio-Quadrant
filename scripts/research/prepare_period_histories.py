"""Independent per-asset histories, without common-date truncation or splicing."""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
from extended_state import ROOT, digest
from prepare_extended_long import french


def checked(series, as_of, earliest):
    if series.index.duplicated().any():
        raise ValueError('Duplicate source month')
    series = series.sort_index().loc[lambda s:(s.index>=pd.Period(earliest,freq='M')) & (s.index<pd.Period(as_of,freq='M'))]
    if len(series)<2 or not np.isfinite(series.to_numpy()).all() or (series<=0).any():
        raise ValueError('Need positive finite individual asset levels')
    if not series.index.equals(pd.period_range(series.index.min(),series.index.max(),freq='M')):
        raise ValueError('Interior monthly gap; do not bridge or fill it')
    return series


def monthly_yahoo(raw):
    q=raw['chart']['result'][0]
    timestamps=q['timestamp'];values=q['indicators']['adjclose'][0]['adjclose']
    if len(timestamps)!=len(values) or len(set(timestamps))!=len(timestamps):
        raise ValueError('Malformed daily adjusted prices')
    dates=pd.to_datetime(timestamps,unit='s',utc=True).tz_convert('America/New_York').tz_localize(None).normalize()
    daily=pd.DataFrame({'date':dates,'price':np.array(values,dtype=float)})
    if not np.isfinite(daily.price).all() or (daily.price<=0).any() or daily.date.duplicated().any():
        raise ValueError('Invalid daily adjusted prices')
    daily=daily.sort_values('date');daily['month']=pd.PeriodIndex(daily.date,freq='M')
    monthly=daily.groupby('month',sort=True).last()
    return monthly.price,dict(zip(monthly.index,monthly.date.dt.strftime('%Y-%m-%d')))


def prepare(folder, etf_dir, output, as_of):
    output.mkdir(parents=True,exist_ok=True)
    factors=french(folder/'french-factors.zip')
    shiller=pd.read_excel(folder/'shiller.xls',sheet_name='Data',header=None)
    if str(shiller.iloc[6,18]).strip()!='Bond' or str(shiller.iloc[7,4]).strip()!='CPI':
        raise ValueError('Shiller source layout changed')
    rows=[]
    for _,r in shiller.iloc[8:].iterrows():
        try:
            value=float(r.iloc[0]);year=int(value);month=round((value-year)*100)
            cpi,bond=float(r.iloc[4]),float(r.iloc[18])
        except (TypeError,ValueError):
            continue
        if 1<=month<=12 and np.isfinite([cpi,bond]).all():
            rows.append((pd.Period(year=year,month=month,freq='M'),cpi*bond))
    if len(dict(rows))!=len(rows):raise ValueError('Duplicate Shiller month')
    gold=pd.read_csv(folder/'worldbank-gold.csv')
    gold=pd.Series(pd.to_numeric(gold.Price).to_numpy(),index=pd.PeriodIndex(gold.Date,freq='M'))
    aqr=pd.read_excel(folder/'aqr-commodities.xlsx',sheet_name='Commodities for the Long Run',header=10)
    excess=pd.Series(pd.to_numeric(aqr['Excess return of equal-weight commodities portfolio']).to_numpy(),
                     index=pd.PeriodIndex(pd.to_datetime(aqr.iloc[:,0]),freq='M'))
    if excess.index.duplicated().any():raise ValueError('Duplicate commodity month')
    total=excess+factors.RF.reindex(excess.index)
    long={'EQUITY':(1+factors['Mkt-RF']+factors.RF).cumprod(),'TREASURY':pd.Series(dict(rows)),
          'GOLD':gold,'COMMODITIES':(1+total.dropna()).cumprod()}
    prior=json.loads((folder/'long-manifest.json').read_text())
    manifests={}
    for panel in ['long','etf']:
        metadata={'version':'per-asset-histories-1','panel':panel,'asOf':as_of,'assets':{},'limitations':[
          'Individual source start/end dates; no provider splice or common-calendar truncation.',
          'Cross-asset means can cover different periods; matched stage comparisons remain within asset.',
          'Long reconstructed bonds/monthly-average gold are not executable closing prices.' if panel=='long' else 'Adjusted histories retrieved for research; not original real-time price captures.']}
        if panel=='long':
            for asset,series in long.items():
                first='1973-01' if asset=='GOLD' else '1960-01'
                series=checked(series,as_of,first)
                filename=panel+'-'+asset+'.csv'
                pd.DataFrame({'date':[str(m.end_time.date()) for m in series.index],'price':series.to_numpy()}).to_csv(output/filename,index=False)
                metadata['assets'][asset]={**prior['assets'][asset],'prices':filename,'pricesSha256':digest(output/filename),
                    'priceStart':str(series.index.min()),'priceEnd':str(series.index.max()),'priceMonths':len(series)}
        else:
            old=json.loads((folder/'etf-manifest.json').read_text())
            for asset in old['assets']:
                source=old['assets'][asset].copy()
                if asset=='SPY':
                    path=folder/'spy-yahoo-daily.json';series,dates=monthly_yahoo(json.loads(path.read_text()))
                    source.update({'source':'https://query1.finance.yahoo.com/v8/finance/chart/SPY',
                                   'sourceFileSha256':digest(path),'note':'Consistent daily-adjusted Yahoo history; monthly last actual traded daily close; no provider splice.'})
                else:
                    raw=pd.read_csv(etf_dir/(asset+'.csv'))
                    series=pd.Series(pd.to_numeric(raw['adjusted close']).to_numpy(),index=pd.PeriodIndex(raw.timestamp,freq='M'))
                    dates=dict(zip(pd.PeriodIndex(raw.timestamp,freq='M'),raw.timestamp))
                series=checked(series,as_of,'1993-01')
                filename=panel+'-'+asset+'.csv'
                pd.DataFrame({'date':[dates[m] for m in series.index],'price':series.to_numpy()}).to_csv(output/filename,index=False)
                metadata['assets'][asset]={**source,'prices':filename,'pricesSha256':digest(output/filename),
                    'priceStart':str(series.index.min()),'priceEnd':str(series.index.max()),'priceMonths':len(series)}
        manifest=output/(panel+'-manifest.json');manifest.write_text(json.dumps(metadata,indent=2)+'\n');manifests[panel]=metadata
    new=pd.read_csv(output/'etf-SPY.csv');new=pd.Series(new.price.to_numpy(),index=pd.PeriodIndex(new.date,freq='M'))
    old=pd.read_csv(etf_dir/'SPY.csv');old=pd.Series(old['adjusted close'].to_numpy(),index=pd.PeriodIndex(old.timestamp,freq='M')).sort_index()
    paired=pd.concat([new.pct_change().rename('new'),old.pct_change().rename('old')],axis=1).dropna()
    difference=(paired.new-paired.old).abs()*10000
    cross={'asset':'SPY','months':len(paired),'first':str(paired.index.min()),'last':str(paired.index.max()),
           'medianDifferenceBps':float(difference.median()),'maxDifferenceBps':float(difference.max()),
           'oldSourceSha256':digest(etf_dir/'SPY.csv'),'newSourceSha256':digest(folder/'spy-yahoo-daily.json')}
    (output/'spy-crosscheck.json').write_text(json.dumps(cross,indent=2)+'\n')
    for panel,meta in manifests.items():
        print(panel,{a:(v['priceStart'],v['priceEnd'],v['priceMonths']) for a,v in meta['assets'].items()})
    print('SPY crosscheck',cross)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder',type=Path,default=ROOT/'work/research/extended')
    parser.add_argument('--etf-dir',type=Path,default=ROOT/'work/research/prices')
    parser.add_argument('--output',type=Path,default=ROOT/'work/research/periods')
    parser.add_argument('--as-of',default='2026-10-26');args=parser.parse_args()
    prepare(args.folder,args.etf_dir,args.output,args.as_of)
