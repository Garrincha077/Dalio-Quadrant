"""Acquire verified public market histories; raw price levels stay private."""
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path

import pandas as pd
import requests

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
WORK=ROOT/'work/research-v5'
spec=importlib.util.spec_from_file_location('v5_keys',HERE.parent/'v2/acquire.py')
keys=importlib.util.module_from_spec(spec);spec.loader.exec_module(keys)


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def request(url,**kwargs):
    try:
        r=requests.get(url,timeout=35,**kwargs)
        if not r.ok:raise RuntimeError(f'Provider HTTP {r.status_code}')
        return r
    except requests.RequestException:
        raise RuntimeError('Market source request failed') from None


def fred(path,params,key):
    r=request('https://api.stlouisfed.org/fred/'+path,params={**params,'api_key':key,'file_type':'json'})
    if 'application/json' not in r.headers.get('content-type',''):raise RuntimeError('FRED returned a non-JSON response')
    data=r.json()
    if 'error_code' in data:raise RuntimeError('FRED rejected source query')
    return data


def price_rows(data,symbol,as_of):
    x=(data.get('chart',{}).get('result') or [None])[0]
    if not x or x['meta'].get('dataGranularity')!='1d' or x['meta'].get('symbol')!=symbol:
        raise ValueError('A genuine daily price history is required')
    quote=x['indicators']['quote'][0]['close']
    adjusted=x['indicators'].get('adjclose',[{}])[0].get('adjclose',quote)
    rows=[]
    for timestamp,close,adj in zip(x['timestamp'],quote,adjusted):
        date=dt.datetime.fromtimestamp(timestamp,dt.timezone.utc).strftime('%Y-%m-%d')
        if date<=as_of and close is not None and adj is not None:rows.append({'date':date,'close':float(close),'adjusted':float(adj)})
    if len({r['date'] for r in rows})!=len(rows) or any(r['close']<=0 or r['adjusted']<=0 for r in rows):
        raise ValueError('Invalid or duplicate daily prices')
    return sorted(rows,key=lambda r:r['date'])


def acquire(as_of='2026-10-21'):
    if as_of>=dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'):raise ValueError('Use a completed source date')
    WORK.mkdir(exist_ok=True,parents=True);(WORK/'fred').mkdir(exist_ok=True)
    key=keys.load_key();manifest={'asOf':as_of,'acquiredAt':dt.datetime.now(dt.timezone.utc).isoformat(),'prices':{},'fred':{},'weeks':[]}
    for name,symbol in [('sp500','^GSPC'),('spy','SPY')]:
        p=WORK/f'{name}-daily.json'
        cached=ROOT/'work/bottoming/spy-daily-yahoo.json'
        if p.exists():data=json.loads(p.read_text())
        elif symbol=='SPY' and cached.exists():data=json.loads(cached.read_text())
        else:
            end=int((dt.datetime.fromisoformat(as_of).replace(tzinfo=dt.timezone.utc)+dt.timedelta(days=1)).timestamp())
            data=request('https://query1.finance.yahoo.com/v8/finance/chart/'+symbol,
                params={'period1':0,'period2':end,'interval':'1d','events':'div,splits'},headers={'User-Agent':'Mozilla/5.0'}).json()
        rows=price_rows(data,symbol,as_of);p.write_text(json.dumps(data,separators=(',',':')))
        manifest['prices'][name]={'symbol':symbol,'file':str(p.relative_to(ROOT)),'sha256':sha(p),
            'source':'Yahoo Finance daily chart','url':'https://finance.yahoo.com/quote/'+symbol+'/history/',
            'granularity':'1d','first':rows[0]['date'],'last':rows[-1]['date'],'count':len(rows)}
        print(json.dumps({'source':symbol,'count':len(rows),'first':rows[0]['date'],'last':rows[-1]['date']}),flush=True)
    sp=price_rows(json.loads((WORK/'sp500-daily.json').read_text()),'^GSPC',as_of)
    spy=price_rows(json.loads((WORK/'spy-daily.json').read_text()),'SPY',as_of)
    f=pd.DataFrame(sp);f['week']=pd.to_datetime(f.date).dt.to_period('W-FRI').dt.end_time.dt.strftime('%Y-%m-%d')
    for _,row in f.groupby('week',sort=True).tail(1).iterrows():
        if row.week>as_of or row.week<'2003-09-22':continue
        following=[r['date'] for r in spy if r['date']>row.week]
        if len(following)<2:continue
        execution=following[1];cutoff=(dt.date.fromisoformat(execution)-dt.timedelta(days=1)).isoformat()
        manifest['weeks'].append({'week':row.week,'priceDate':row.date,'executionDate':execution,'cutoff':cutoff})
    cboe=WORK/'cboe-vix.csv';url='https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'
    if not cboe.exists():cboe.write_bytes(request(url).content)
    v=pd.read_csv(cboe);v['date']=pd.to_datetime(v.DATE).dt.strftime('%Y-%m-%d');v=v[v.date<=as_of]
    if v.date.duplicated().any() or not (v.CLOSE>0).all():raise ValueError('Invalid CBOE VIX history')
    manifest['cboe']={'url':url,'file':str(cboe.relative_to(ROOT)),'sha256':sha(cboe),'first':v.date.min(),'last':v.date.max(),'count':len(v)}
    metadata={}
    for sid in ['VIXCLS','BAMLH0A0HYM2']:
        info=fred('series',{'series_id':sid},key)['seriess'][0]
        vintage=fred('series/vintagedates',{'series_id':sid,'sort_order':'asc','limit':1},key)['vintage_dates'][0]
        metadata[sid]={'id':sid,'first':info['observation_start'],'last':info['observation_end'],
            'firstVintage':vintage,'units':info['units'],'url':'https://fred.stlouisfed.org/series/'+sid}
    minimum=max(metadata['BAMLH0A0HYM2']['first'],*[x['firstVintage'] for x in metadata.values()])
    cutoffs=[r['cutoff'] for r in manifest['weeks'] if r['priceDate']>=minimum]
    cutoffs=sorted(set([*cutoffs,as_of]))
    for sid,meta in metadata.items():
        p=WORK/f'fred/{sid}.json'
        cached=json.loads(p.read_text()) if p.exists() else None
        if cached and cached.get('cutoffs')==cutoffs and cached.get('asOf')==as_of:
            data=cached
        else:
            merged={}
            for start in range(0,len(cutoffs),40):
                payload=fred('series/observations',{'series_id':sid,'vintage_dates':','.join(cutoffs[start:start+40]),
                    'output_type':2,'observation_start':minimum,'observation_end':as_of,'limit':100000},key)
                if len(payload['observations'])!=payload['count']:raise ValueError('Truncated original-vintage source')
                for row in payload['observations']:merged.setdefault(row['date'],{}).update(row)
            data={'series':sid,'asOf':as_of,'cutoffs':cutoffs,'observations':sorted(merged.values(),key=lambda r:r['date'])}
            p.write_text(json.dumps(data,separators=(',',':')))
        manifest['fred'][sid]={**meta,'file':str(p.relative_to(ROOT)),'sha256':sha(p),'cutoffs':len(cutoffs)}
        print(json.dumps({'source':sid,'first':meta['first'],'firstVintage':meta['firstVintage'],'snapshots':len(cutoffs)}),flush=True)
    manifest['protocolSha256']=sha(HERE/'protocol.md')
    (WORK/'source-manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps({'weeks':len(manifest['weeks']),'status':'source-acquisition-complete'}),flush=True)
    return manifest


if __name__=='__main__':acquire()
