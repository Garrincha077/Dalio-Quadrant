"""Original severity classifier and source-limited, deduplicated event study."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import acquire

ROOT,WORK,HERE=acquire.ROOT,acquire.WORK,acquire.HERE
RULES=[{'level':1,'label':'Bull Reset','rsi':40,'vix':25,'hy':4.5,'required':2},
    {'level':2,'label':'Cyclical Bottom','rsi':33,'vix':30,'hy':6.,'required':2},
    {'level':3,'label':'Systemic Bottom','rsi':30,'vix':40,'hy':8.,'required':3}]
HORIZONS=[21,63,126,252]


def safe(x):
    if isinstance(x,dict):return {k:safe(v) for k,v in x.items()}
    if isinstance(x,(list,tuple,np.ndarray)):return [safe(v) for v in x]
    if isinstance(x,np.bool_):return bool(x)
    if isinstance(x,np.integer):return int(x)
    if isinstance(x,(float,np.floating)):return float(x) if np.isfinite(x) else None
    return x


def classify(rsi,vix,hy):
    values=[rsi,vix,hy];confirmed=possible=0
    for r in RULES:
        tests=[None if x is None or not np.isfinite(x) else bool(x<=r[k] if k=='rsi' else x>=r[k]) for k,x in zip(['rsi','vix','hy'],values)]
        count=sum(t is True for t in tests);missing=sum(t is None for t in tests)
        if count>=r['required']:confirmed=r['level']
        if count+missing>=r['required']:possible=r['level']
    return {'level':confirmed if confirmed==possible else None,'lower':confirmed,'upper':possible,
        'complete':all(x is not None and np.isfinite(x) for x in values)}


def weekly_rsi(prices,as_of,period=14):
    f=pd.DataFrame(prices);f['week']=pd.to_datetime(f.date).dt.to_period('W-FRI')
    w=f.groupby('week',sort=True).tail(1).set_index('week');w=w[w.index.end_time.normalize()<=pd.Timestamp(as_of)]
    # Seed an exponential series with the first fourteen changes' arithmetic
    # means, then let pandas independently apply the Wilder recursion.
    w['rsi']=np.nan
    partitions=np.r_[True,np.diff(w.index.asi8)!=1].cumsum()
    for _,part in w.groupby(partitions):
        if len(part)<=period:continue
        changes=part.close.diff().iloc[1:];up=changes.clip(lower=0);down=(-changes).clip(lower=0)
        gains=pd.concat([pd.Series([up.iloc[:period].mean()],index=[part.index[period]]),up.iloc[period:]])
        losses=pd.concat([pd.Series([down.iloc[:period].mean()],index=[part.index[period]]),down.iloc[period:]])
        gain=gains.ewm(alpha=1/period,adjust=False).mean();loss=losses.ewm(alpha=1/period,adjust=False).mean()
        rsi=100-100/(1+gain/loss);rsi[(gain==0)&(loss==0)]=50;rsi[(gain>0)&(loss==0)]=100
        w.loc[rsi.index,'rsi']=rsi
    return {str(i.end_time.date()):{'date':r.date,'rsi':float(r.rsi) if pd.notna(r.rsi) else None} for i,r in w.iterrows()}


def original(source,cutoff,date):
    if cutoff not in source['cutoffs'] or date>cutoff:return None
    key=source['series']+'_'+cutoff.replace('-','')
    row=next((r for r in source['observations'] if r['date']==date),{})
    try:
        v=float(row.get(key,'nan'));return v if np.isfinite(v) else None
    except (TypeError,ValueError):return None


def new_episodes(weeks,predicate,full=False):
    result=[];previous=None;last_week=None
    for row in weeks:
        available=(row['complete'] if full else row['rsi'] is not None and row['vix'] is not None)
        value=bool(predicate(row)) if available else None
        consecutive=last_week is not None and (pd.Timestamp(row['week'])-pd.Timestamp(last_week)).days==7
        if value is True and previous is False and consecutive:
            result.append({k:row[k] for k in ['week','priceDate','executionDate','cutoff','rsi','vix','hy','level','lower','upper','context']})
        previous=value;last_week=row['week']
    return result


def outcome(index,prices,h):
    if index+h>=len(prices):return None
    start=prices[index]['adjusted'];path=np.array([r['adjusted']/start-1 for r in prices[index:index+h+1]])
    gross=float(path[-1])
    return {'endDate':prices[index+h]['date'],'grossReturn':gross,
        'netReturn':(1+gross)*(.999**2)-1,'stressReturn':(1+gross)*(.9975**2)-1,'mae':float(path.min())}


def stats(rows):
    complete=[r for r in rows if r['status']=='included']
    return {'n':len(complete),'meanNetReturn':float(np.mean([r['netReturn'] for r in complete])) if complete else None,
        'medianNetReturn':float(np.median([r['netReturn'] for r in complete])) if complete else None,
        'positiveShare':float(np.mean([r['netReturn']>0 for r in complete])) if complete else None,
        'meanStressReturn':float(np.mean([r['stressReturn'] for r in complete])) if complete else None,
        'meanMAE':float(np.mean([r['mae'] for r in complete])) if complete else None,
        'worstMAE':float(min(r['mae'] for r in complete)) if complete else None,
        'overlapSkipped':sum(r['status']=='overlap skipped' for r in rows),'unmatured':sum(r['status']=='not yet mature' for r in rows)}


def event_sample(entries,prices,h,cooldown=True):
    lookup={r['date']:i for i,r in enumerate(prices)};last_end=-1;rows=[]
    for entry in entries:
        i=lookup[entry['executionDate']];r=dict(entry)
        if cooldown and i<last_end:r['status']='overlap skipped'
        else:
            value=outcome(i,prices,h);last_end=i+h
            if value:r.update({'status':'included',**value})
            else:r['status']='not yet mature'
        rows.append(r)
    return {'stats':stats(rows),'entries':rows}


def build():
    manifest=json.loads((WORK/'source-manifest.json').read_text())
    if manifest['protocolSha256']!=acquire.sha(HERE/'protocol.md'):raise ValueError('Frozen protocol differs')
    sources=[*manifest['prices'].values(),manifest['cboe'],*manifest['fred'].values()]
    for source in sources:
        if acquire.sha(ROOT/source['file'])!=source['sha256']:raise ValueError('Source changed after acquisition')
    index=acquire.price_rows(json.loads((WORK/'sp500-daily.json').read_text()),'^GSPC',manifest['asOf'])
    prices=acquire.price_rows(json.loads((WORK/'spy-daily.json').read_text()),'SPY',manifest['asOf'])
    w=weekly_rsi(index,manifest['asOf'])
    c=pd.read_csv(WORK/'cboe-vix.csv');cboe={pd.Timestamp(r.DATE).strftime('%Y-%m-%d'):float(r.CLOSE) for _,r in c.iterrows()}
    fred={sid:json.loads((WORK/f'fred/{sid}.json').read_text()) for sid in manifest['fred']}
    macro=json.loads((ROOT/'work/research-v2/features.json').read_text())['rows']
    value=json.loads((ROOT/'work/research-v3/features.json').read_text())['rows']
    weeks=[];previous=None
    for base in manifest['weeks']:
        row={**base,'rsi':w[base['week']]['rsi']};cutoff=base['cutoff'];date=base['priceDate']
        original_vix=original(fred['VIXCLS'],cutoff,date)
        has_snapshot=cutoff in fred['VIXCLS']['cutoffs']
        row['vix']=original_vix if has_snapshot else cboe.get(date)
        row['hy']=original(fred['BAMLH0A0HYM2'],cutoff,date)
        row['vixSource']='FRED original vintage' if has_snapshot else 'CBOE retrospective daily close'
        row.update(classify(row['rsi'],row['vix'],row['hy']))
        row['fullEligible']=bool(row['complete'] and has_snapshot)
        row['newSignal']=bool(previous and previous['complete'] and row['complete'] and row['level']>previous['level'] and row['level']>0)
        m=next((r for r in reversed(macro) if r['cutoff']<=cutoff),None)
        v=next((r for r in reversed(value) if r['cutoff']<=cutoff),None)
        row['context']={'macroCutoff':m['cutoff'] if m else None,'activity':m['activity'] if m else None,
            'inflationGap':m['inflationGap'] if m else None,'growthMomentum':m['growth'] if m else None,
            'inflationMomentum':m['inflation'] if m else None,'scoreCutoff':v['cutoff'] if v else None,
            'spyValueZ':v['assets']['SPY']['value']['z'] if v else None,'spyPriceZ':v['assets']['SPY']['price']['z'] if v else None}
        weeks.append(row);previous=row
    definitions={
        'full':{'label':'Original three-input rule','requireFull':True,
            'rules':{'level1':('L1 or higher',lambda r:r['level']>=1),'level2':('L2 or higher',lambda r:r['level']>=2),
                'level3':('L3 only',lambda r:r['level']==3),'rsi':('RSI ≤40 only',lambda r:r['rsi']<=40),
                'vix':('VIX ≥25 only',lambda r:r['vix']>=25),'hy':('HY ≥4.5% only',lambda r:r['hy']>=4.5)}},
        'two':{'label':'Separate RSI + VIX ablation; HY unavailable historically','requireFull':False,
            'rules':{'both1':('RSI ≤40 AND VIX ≥25',lambda r:r['rsi']<=40 and r['vix']>=25),
                'both2':('RSI ≤33 AND VIX ≥30',lambda r:r['rsi']<=33 and r['vix']>=30),
                'rsi':('RSI ≤40 only',lambda r:r['rsi']<=40),'vix':('VIX ≥25 only',lambda r:r['vix']>=25)}}}
    studies={}
    for cohort,d in definitions.items():
        eligible=[r for r in weeks if (r['fullEligible'] if d['requireFull'] else r['rsi'] is not None and r['vix'] is not None)]
        study={'label':d['label'],'first':eligible[0]['week'],'last':eligible[-1]['week'],'eligibleWeeks':len(eligible),'rules':{},'unconditional':{}}
        for key,(label,predicate) in d['rules'].items():
            entries=new_episodes(weeks,predicate,d['requireFull'])
            study['rules'][key]={'label':label,'setupEpisodes':len(entries),'horizons':{str(h):event_sample(entries,prices,h) for h in HORIZONS}}
        for h in HORIZONS:study['unconditional'][str(h)]=event_sample(eligible,prices,h,False)['stats']
        studies[cohort]=study
    latest=dict(weeks[-1]);latest['informationCutoff']=manifest['asOf']
    latest['vix']=original(fred['VIXCLS'],manifest['asOf'],latest['priceDate'])
    latest['hy']=original(fred['BAMLH0A0HYM2'],manifest['asOf'],latest['priceDate'])
    latest.update(classify(latest['rsi'],latest['vix'],latest['hy']))
    output={'version':'bottoming-research-5','methodVersion':'bottoming-0-3-1','status':'descriptive-retrospective-source-limited',
        'asOf':manifest['asOf'],'acquiredAt':manifest['acquiredAt'],'protocolSha256':manifest['protocolSha256'],
        'sourceManifestSha256':acquire.sha(WORK/'source-manifest.json'),'rules':RULES,'rsiPeriod':14,
        'rsiPeriodAssumed':True,'primaryHorizon':252,'horizons':HORIZONS,'confirmedEdge':False,
        'latest':latest,'weeks':weeks,'studies':studies,'sources':sources,
        'macroInputSha256':acquire.sha(ROOT/'work/research-v2/features.json'),
        'scoreInputSha256':acquire.sha(ROOT/'work/research-v3/features.json'),
        'limitations':['Weekly RSI period 14 is an explicit assumption; screenshots do not show the period.',
            'Levels describe severity of stress, not confirmation that a price bottom has occurred.',
            'Full original HY coverage is short; older RSI/VIX results are a separate two-input ablation.',
            'Historical index/ETF prices and CBOE history are downloaded retrospective histories, not recorded live forecasts.',
            'Episodes and no-overlap sampling reduce repetitions but do not create many independent economic crises.',
            'Event returns after entry/exit fees are not a continuously invested portfolio CAGR.',
            'Unconditional weekly references overlap and are descriptive, not paired causal advantage tests.',
            'No significance claim or confirmed predictive edge is emitted.']}
    (WORK/'research-candidate.json').write_text(json.dumps(safe(output),separators=(',',':'),allow_nan=False))
    print(json.dumps({'weeks':len(weeks),'fullWeeks':studies['full']['eligibleWeeks'],'fullCoverage':[studies['full']['first'],studies['full']['last']],
        'latest':{k:latest[k] for k in ['week','rsi','vix','hy','level']},'setups':{c:{k:v['setupEpisodes'] for k,v in s['rules'].items()} for c,s in studies.items()}}))
    return output


if __name__=='__main__':build()
