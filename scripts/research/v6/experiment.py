"""Frozen recovery strategies; continuous self-financing portfolios, no fitted winner."""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];WORK=ROOT/'work/research-v6'
spec=importlib.util.spec_from_file_location('v5acquire',HERE.parent/'v5/acquire.py')
source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
RULES=['immediate','stress','recovery','price','price-z','macro','value']
LABELS={'immediate':'Immediate L2+','stress':'VIX + HY improving','recovery':'Stress improving + price trend',
    'price':'Price trend only after L2+','price-z':'Recovery + price z ≤0','macro':'Recovery + benign macro momentum',
    'value':'Recovery + value z ≥0','market':'Risk-capped SPY','trend':'40-week trend only','cash':'Cash carry'}
FOLDS=[('Through 2010','0000','2011'),('2011–2019','2011','2020'),('2020–2022','2020','2023'),('2023 onward','2023','9999')]

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def safe(v):
    if isinstance(v,dict):return {k:safe(x) for k,x in v.items()}
    if isinstance(v,(tuple,list,np.ndarray)):return [safe(x) for x in v]
    if isinstance(v,(np.bool_,)):return bool(v)
    if isinstance(v,(np.integer,)):return int(v)
    if isinstance(v,(np.floating,float)):return float(v) if np.isfinite(v) else None
    return v

def known(rows,cutoff):
    r=next((r for r in reversed(rows) if r['cutoff']<=cutoff),None)
    return r if r and (pd.Timestamp(cutoff)-pd.Timestamp(r['cutoff'])).days<=62 else None

def calendar(data,index,spy,macro,scores):
    idx=pd.DataFrame(index);idx['week']=pd.to_datetime(idx.date).dt.to_period('W-FRI')
    iw=idx.groupby('week').tail(1).set_index('week').close
    sp=pd.DataFrame(spy);sp['week']=pd.to_datetime(sp.date).dt.to_period('W-FRI')
    sw=sp.groupby('week').tail(1).set_index('week').adjusted
    # All histories end at the relevant completed week; incomplete current week is never selected.
    m10=iw.rolling(10,min_periods=10).mean();m40=iw.rolling(40,min_periods=40).mean()
    vol=sw.pct_change(fill_method=None).rolling(52,min_periods=52).std(ddof=1)*np.sqrt(52)
    lookup={r['date']:i for i,r in enumerate(spy)};out=[]
    for i,base in enumerate(data['archiveWeeks']):
        row=dict(base);p=pd.Period(base['week'],freq='W-FRI');m=known(macro,base['cutoff']);v=known(scores,base['cutoff'])
        row.update({'i':i,'gap10':float(iw[p]/m10[p]-1),'gap40':float(iw[p]/m40[p]-1),'pastVol':float(vol[p]),
            'macroCutoff':m['cutoff'] if m else None,'scoreCutoff':v['cutoff'] if v else None,
            'growth':m['growth'] if m else None,'inflation':m['inflation'] if m else None,
            'priceZ':v['assets']['SPY']['price']['z'] if v else None,'valueZ':v['assets']['SPY']['value']['z'] if v else None,
            'cashYield':m['cashYield'] if m else None})
        previous=data['archiveWeeks'][i-1] if i else None
        row['setup']=bool(previous and previous['complete'] and row['complete'] and
            (pd.Timestamp(row['week'])-pd.Timestamp(previous['week'])).days==7 and previous['level']<2 and row['level']>=2)
        before=data['archiveWeeks'][i-4] if i>=4 else None
        row['stressImproving']=bool(before and (pd.Timestamp(row['week'])-pd.Timestamp(before['week'])).days==28 and
            all(x is not None for x in [row['vix'],row['hy'],before['vix'],before['hy']]) and row['vix']<before['vix'] and row['hy']<before['hy'])
        row['riskCap']=min(1.,.10/row['pastVol']) if np.isfinite(row['pastVol']) and row['pastVol']>0 else 0.
        row['entryIndex']=lookup[row['executionDate']]
        row['endDate']=data['archiveWeeks'][i+1]['executionDate'] if i+1<len(data['archiveWeeks']) else None
        row['endIndex']=lookup[row['endDate']] if row['endDate'] else None
        if row['endDate']:
            if row['cashYield'] is None:raise ValueError('Missing cash history; continuous policy withheld')
            row['days']=(pd.Timestamp(row['endDate'])-pd.Timestamp(row['executionDate'])).days
            row['marketReturn']=spy[row['endIndex']]['adjusted']/spy[row['entryIndex']]['adjusted']-1
            row['cashReturn']=(1+row['cashYield']/100)**(row['days']/365)-1
        else:row.update({'days':None,'marketReturn':None,'cashReturn':None})
        out.append(row)
    return out

def condition(rule,r):
    if rule=='immediate':return True
    price=r['gap10']>0
    if rule=='price':return price
    if rule=='stress':return r['stressImproving']
    recovery=r['stressImproving'] and price
    if rule=='recovery':return recovery
    if rule=='price-z':return recovery and r['priceZ'] is not None and r['priceZ']<=0
    if rule=='macro':return recovery and r['growth'] is not None and r['inflation'] is not None and r['growth']>0 and r['inflation']<0
    if rule=='value':return recovery and r['valueZ'] is not None and r['valueZ']>=0
    raise ValueError('Unknown rule')

def confirmations(rows,start,rule):
    records=[];pending=None
    for r in rows[start:]:
        if pending is not None and r['i']>pending['setupIndex']+26:
            pending['status']='expired';pending['resolvedWeek']=r['week'];pending=None
        if r['setup']:
            record={'setupWeek':r['week'],'setupIndex':r['i'],'status':'pending','deadlineWeek':str((pd.Timestamp(r['week'])+pd.Timedelta(weeks=26)).date())}
            if pending is not None:record.update({'status':'merged','mergedInto':pending['setupWeek']})
            else:pending=record
            records.append(record)
        if pending is not None and condition(rule,r):
            pending.update({'status':'confirmed','confirmationWeek':r['week'],'confirmationIndex':r['i'],
                'executionDate':r['executionDate'],'delayWeeks':r['i']-pending['setupIndex']});pending=None
    return records

def trade(before,target,fee):
    amount=(target-before)/(1+fee*target) if target>=before else (before-target)/(1-fee*target)
    return amount,fee*amount

def metrics(rows,cal,marks):
    if not rows:return {'available':False}
    returns=np.array([r['return'] for r in rows]);cash=np.array([cal[r['i']]['cashReturn'] for r in rows]);ex=returns-cash
    years=sum(cal[r['i']]['days'] for r in rows)/365.25
    wealth=1.;daily={};turnover=0.
    for r in rows:
        for date,factor in marks[r['i']]:daily[date]=wealth*factor
        wealth*=1+r['return'];turnover+=r['turnover']+r['terminalTurnover']
    peak=1.;drawdown=0.
    for value in daily.values():peak=max(peak,value);drawdown=min(drawdown,value/peak-1)
    sd=ex.std(ddof=1) if len(ex)>1 else 0.
    return {'available':True,'n':len(rows),'first':cal[rows[0]['i']]['executionDate'],'last':cal[rows[-1]['i']]['endDate'],
        'cagr':wealth**(1/years)-1,'volatility':returns.std(ddof=1)*np.sqrt(52) if len(returns)>1 else None,
        'sharpe':ex.mean()/sd*np.sqrt(52) if sd>1e-12 else None,'annualMeanExcess':ex.mean()*52,
        'maxDrawdown':drawdown,'finalWealth':wealth,'cagrAt25bps':np.prod([1+r['stressReturn'] for r in rows])**(1/years)-1,
        'riskyExposure':sum(r['weight']*cal[r['i']]['days'] for r in rows)/(years*365.25),'turnoverAnnual':turnover/years}

def policy(cal,spy,start,key,records):
    kind,rule=key.split(':') if ':' in key else (key,None)
    signals={r['confirmationIndex'] for r in records if r['status']=='confirmed'}
    before=0.;until=-1;path=[];marks={};executions=[]
    for i in range(start,len(cal)-1):
        r=cal[i];signal=i in signals
        if signal:
            ignored=i<until
            executions.append({'week':r['week'],'executionDate':r['executionDate'],'status':'ignored; existing event position' if ignored else 'entered','untilIndex':until if ignored else i+52})
            if not ignored:until=i+52
        active=i<until;core=r['gap40']>0
        on=kind=='market' or kind=='trend' and core or kind=='event' and active or kind=='overlay' and (active or core)
        weight=r['riskCap'] if on else 0.
        notional,cost=trade(before,weight,.001);_,stressCost=trade(before,weight,.0025)
        growth=weight*(1+r['marketReturn'])+(1-weight)*(1+r['cashReturn'])
        drift=weight*(1+r['marketReturn'])/growth
        terminal=.001*drift if i==len(cal)-2 else 0.;stressTerminal=.0025*drift if i==len(cal)-2 else 0.
        gross=(1-cost)*growth*(1-terminal);stress=(1-stressCost)*growth*(1-stressTerminal)
        row={'i':i,'weight':weight,'return':gross-1,'stressReturn':stress-1,'turnover':notional,'cost':cost,
            'terminalCost':terminal,'terminalTurnover':drift if terminal else 0.,'eventActive':active,'coreOn':core}
        path.append(row);before=drift
        dates=spy[r['entryIndex']:r['endIndex']+1];base=dates[0]['adjusted'];daily=[]
        for p in dates:
            days=(pd.Timestamp(p['date'])-pd.Timestamp(r['executionDate'])).days
            factor=(1-cost)*(weight*p['adjusted']/base+(1-weight)*(1+r['cashYield']/100)**(days/365))
            if p['date']==r['endDate']:factor*=1-terminal
            daily.append((p['date'],factor))
        marks[i]=daily
    result={'label':LABELS.get(rule or key),'kind':kind,'rule':rule,'rows':path,'executions':executions}
    result.update(metrics(path,cal,marks));result['folds']={};result['omitBlocks']={}
    for label,begin,end in FOLDS:
        subset=[r for r in path if begin<=cal[r['i']]['executionDate'][:4]<end]
        if subset:result['folds'][label]=metrics(subset,cal,marks)
        rest=[r for r in path if not begin<=cal[r['i']]['executionDate'][:4]<end]
        if subset and rest:result['omitBlocks'][label]=metrics(rest,cal,marks)
    return result

def gates(a,b):
    risk=a['volatility']<=1.1*b['volatility']+1e-12
    returns=a['cagr']>b['cagr'] and risk and a['maxDrawdown']>=b['maxDrawdown']-1e-12
    defensive=a['cagr']>=b['cagr']-.005 and risk and abs(a['maxDrawdown'])<=.8*abs(b['maxDrawdown']) and a['sharpe'] is not None and b['sharpe'] is not None and a['sharpe']>b['sharpe']
    return {'higherReturn':returns,'defensiveTradeoff':defensive}

def paired(a,b,cash,ix):
    def sharpe(r,c):
        x=r-c;return x.mean(axis=-1)/x.std(axis=-1,ddof=1)*np.sqrt(52)
    observed=float(sharpe(a,cash)-sharpe(b,cash));draws=sharpe(a[ix],cash[ix])-sharpe(b[ix],cash[ix])
    p=(1+np.count_nonzero(np.abs(draws-observed)>=abs(observed)-1e-12))/(len(draws)+1)
    return {'difference':observed,'lower95':float(np.quantile(draws,.025)),'upper95':float(np.quantile(draws,.975)),
        'p':float(p),'blockWeeks':52,'replications':len(ix),'n':len(a)}

def build():
    WORK.mkdir(exist_ok=True,parents=True)
    data=json.loads((ROOT/'data/bottoming.json').read_text());assert data['audit']['status']=='Independent source reconstruction passed'
    for receipt in data['sources']:assert sha(ROOT/receipt['file'])==receipt['sha256']
    manifest=json.loads((ROOT/'work/research-v5/source-manifest.json').read_text())
    index=source.price_rows(json.loads((ROOT/'work/research-v5/sp500-daily.json').read_text()),'^GSPC',data['asOf'])
    spy=source.price_rows(json.loads((ROOT/'work/research-v5/spy-daily.json').read_text()),'SPY',data['asOf'])
    macro=json.loads((ROOT/'work/research-v2/features.json').read_text())['rows'];scores=json.loads((ROOT/'work/research-v3/features.json').read_text())['rows']
    cal=calendar(data,index,spy,macro,scores)
    cohorts={'main':(0,RULES[:4]),'price':(next(r['i'] for r in cal if r['priceZ'] is not None),RULES[:5]),
        'context':(next(r['i'] for r in cal if all(r[k] is not None for k in ['priceZ','valueZ','growth','inflation'])),RULES)}
    studies={}
    for cohort,(start,rules) in cohorts.items():
        signals={rule:confirmations(cal,start,rule) for rule in rules};strategies={k:policy(cal,spy,start,k,[]) for k in ['market','trend','cash']}
        for rule in rules:
            for kind in ['event','overlay']:
                key=f'{kind}:{rule}';strategies[key]=policy(cal,spy,start,key,signals[rule])
        for key,s in strategies.items():
            if ':' not in key:continue
            kind,rule=key.split(':');s['gates']={ref:gates(s,strategies[ref]) for ref in [f'{kind}:immediate','trend','market']}
            s['economicCandidate']=all(g['higherReturn'] for g in s['gates'].values())
            s['defensiveCandidate']=all(g['defensiveTradeoff'] for g in s['gates'].values())
            s['confirmedEdge']=False
        studies[cohort]={'firstWeek':cal[start]['week'],'lastWeek':cal[-2]['week'],'startIndex':start,
            'holdingIntervals':len(cal)-1-start,'rules':rules,'signals':signals,'strategies':strategies}
        print(json.dumps({'cohort':cohort,'coverage':[cal[start]['week'],cal[-2]['week']],
            'results':{k:{f:s.get(f) for f in ['cagr','volatility','sharpe','maxDrawdown','economicCandidate','defensiveCandidate']} for k,s in strategies.items()}}),flush=True)
    n=len(studies['main']['strategies']['market']['rows']);rng=np.random.default_rng(20261022)
    starts=rng.integers(0,n,size=(2500,int(np.ceil(n/52))))
    ix=((starts[:,:,None]+np.arange(52))%n).reshape(2500,-1)[:,:n]
    comparisons=[];s=studies['main']['strategies'];cash=np.array([r['cashReturn'] for r in cal[:-1]])
    for rule in ['stress','recovery']:
        for reference in ['overlay:immediate','trend','market']:
            a=s[f'overlay:{rule}'];b=s[reference]
            comparison={'model':f'overlay:{rule}','reference':reference,
                **paired(np.array([r['return'] for r in a['rows']]),np.array([r['return'] for r in b['rows']]),cash,ix)}
            comparison['foldGains']={label:a['folds'][label]['annualMeanExcess']-b['folds'][label]['annualMeanExcess'] for label in a['folds']}
            comparisons.append(comparison)
    prior=0.
    for rank,c in enumerate(sorted(comparisons,key=lambda c:c['p'])):
        prior=min(1.,max(prior,(6-rank)*c['p']));c['holmP']=prior
    for rule in ['stress','recovery']:
        a=s[f'overlay:{rule}'];tests=[c for c in comparisons if c['model']==f'overlay:{rule}']
        a['strongerRetrospectiveSupport']=bool((a['economicCandidate'] or a['defensiveCandidate']) and all(c['lower95']>0 and c['holmP']<.05 for c in tests) and all(v>0 for v in tests[0]['foldGains'].values()))
    # Raw prices and private cash yield are used only by independent reconstruction.
    publicCal=[{k:v for k,v in r.items() if k not in ['entryIndex','endIndex','cashYield','context','fullEligible','archiveEligible','newSignal']} for r in cal]
    output={'version':'recovery-research-6','asOf':data['asOf'],'status':'retrospective-already-inspected-history','confirmedEdge':False,
        'protocolSha256':sha(HERE/'protocol.md'),'bottomingInputSha256':sha(ROOT/'data/bottoming.json'),
        'macroInputSha256':sha(ROOT/'work/research-v2/features.json'),'scoreInputSha256':sha(ROOT/'work/research-v3/features.json'),
        'sourceManifestSha256':sha(ROOT/'work/research-v5/source-manifest.json'),'ruleLabels':LABELS,'procedureCount':41,
        'primaryComparisons':comparisons,'calendar':publicCal,'cohorts':studies,
        'limitations':['All historical periods were inspected before this round; these are retrospective comparisons, not an untouched test.',
            'Older HY and VIX histories lack original release vintages. Archive overlap agreement does not recover publication times.',
            'Many waiting weeks, holdings and related entry rules share a small number of economic crises.',
            'Risk is estimated from prior weeks; a 10% past-risk cap cannot guarantee 10% realized volatility.',
            'TB3MS cash carry approximates a discount yield as an effective annual yield and excludes fund fees and taxes.',
            '52 weekly holding intervals approximate 12 months; this is separate from the original 252-session event study.',
            'Daily-close maximum drawdown excludes intraday losses. Execution assumes the published adjusted close is obtainable.',
            'Price z and value z have opposite condition signs and different meanings; unavailable filters withhold entries.',
            'Block omissions concatenate retained returns as sensitivity diagnostics, not a continuously tradable policy.',
            'Six-test correction applies to this declared primary family; earlier experiments remain disclosed and no edge is confirmed.']}
    (WORK/'research-candidate.json').write_text(json.dumps(safe(output),separators=(',',':'),allow_nan=False))
    (WORK/'bootstrap-starts.json').write_text(json.dumps(starts.tolist(),separators=(',',':')))
    (WORK/'private-calendar.json').write_text(json.dumps(safe(cal),separators=(',',':')))
    print(json.dumps({'comparisons':comparisons}),flush=True)
    return output
if __name__=='__main__':build()
