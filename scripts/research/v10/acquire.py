"""Daily ETF sources with frozen cutoff and independent monthly-ratio checks."""
import concurrent.futures as cf
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
import pandas as pd
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];WORK=ROOT/'work/research-v10';ASOF='2026-10-21'
spec=importlib.util.spec_from_file_location('shock_price_source',HERE.parent/'v5/acquire.py');source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
ASSETS=['SPY','IEF','GLD','TIP','DBC']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def acquire_one(asset):
    path=ROOT/'work/research-v5/spy-daily.json' if asset=='SPY' else WORK/f'{asset}-daily.json'
    if path.exists():data=json.loads(path.read_text())
    else:
        end=int((dt.datetime.fromisoformat(ASOF).replace(tzinfo=dt.timezone.utc)+dt.timedelta(days=1)).timestamp())
        data=source.request('https://query1.finance.yahoo.com/v8/finance/chart/'+asset,params={'period1':0,'period2':end,'interval':'1d','events':'div,splits'},headers={'User-Agent':'Mozilla/5.0'}).json()
        source.price_rows(data,asset,ASOF);path.write_text(json.dumps(data,separators=(',',':')))
    rows=source.price_rows(data,asset,ASOF);daily={r['date']:r for r in rows};monthly=pd.read_csv(ROOT/f'work/research-v2/prices/{asset}.csv').sort_values('timestamp');monthly=monthly[monthly.timestamp.str[:7]<ASOF[:7]]
    pairs=[]
    for k in range(1,len(monthly)):
        a,b=monthly.iloc[k-1],monthly.iloc[k]
        if a.timestamp in daily and b.timestamp in daily:
            old=float(b['adjusted close']/a['adjusted close']-1);new=daily[b.timestamp]['adjusted']/daily[a.timestamp]['adjusted']-1;pairs.append({'date':b.timestamp,'difference':new-old})
    errors=np.array([abs(r['difference']) for r in pairs]);checked=len(errors)>=120 and float(errors.max())<=.002 and float(np.quantile(errors,.95))<=.0002
    receipt={'symbol':asset,'file':str(path.relative_to(ROOT)),'sha256':sha(path),'source':'Yahoo Finance genuine daily adjusted/unadjusted close','url':f'https://finance.yahoo.com/quote/{asset}/history/','first':rows[0]['date'],'last':rows[-1]['date'],'n':len(rows),
        'monthlyCheck':{'source':f'work/research-v2/prices/{asset}.csv','sha256':sha(ROOT/f'work/research-v2/prices/{asset}.csv'),'n':len(pairs),'maximumReturnDifference':float(errors.max()),'p95ReturnDifference':float(np.quantile(errors,.95)),'maxTolerance':.002,'p95Tolerance':.0002,'status':'passed' if checked else 'needs-review','outliers':[r for r in pairs if abs(r['difference'])>.002]}}
    return receipt

def acquire():
    WORK.mkdir(parents=True,exist_ok=True)
    with cf.ThreadPoolExecutor(max_workers=4) as pool:receipts=list(pool.map(acquire_one,ASSETS))
    manifest={'asOf':ASOF,'acquiredAt':dt.datetime.now(dt.timezone.utc).isoformat(),'protocolSha256':sha(HERE/'protocol.md'),'prices':receipts}
    (WORK/'source-manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest));return manifest
if __name__=='__main__':acquire()
