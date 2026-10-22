"""Practical forecast guard: six frozen forecast policies, no new fitting."""
import importlib.util
import json
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];WORK=ROOT/'work/research-v8'
spec=importlib.util.spec_from_file_location('guard_policy_engine',HERE.parent/'v6/experiment.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)

def guard_weight(variance,past_vol):
    if variance is None or past_vol is None or not np.isfinite(variance) or not np.isfinite(past_vol) or variance<=0 or past_vol<=0:return 0.
    return min(1.,.10/np.sqrt(variance),.10/past_vol)

def build():
    risk=json.loads((ROOT/'data/risk-research.json').read_text());assert risk['audit']['status']=='Independent refits and reconstruction passed'
    study=risk['horizons']['4']['main'];cal=json.loads((ROOT/'work/research-v6/private-calendar.json').read_text());lookup={r['i']:r for r in study['forecasts']}
    spy=engine.source.price_rows(json.loads((ROOT/'work/research-v5/spy-daily.json').read_text()),'SPY',risk['asOf'])
    policies={}
    for model in study['models']:
        clock=[dict(r,riskCap=guard_weight(lookup[r['i']]['predictions'][model],r['pastVol']) if r['i'] in lookup else 0.) for r in cal]
        p=engine.policy(clock,spy,study['calendarStartIndex'],'market',[]);p['label']='Guarded '+risk['modelLabels'][model];p['kind']='forecast-guard';policies[model]=p
    references={'past52':study['strategies']['past52'],'market':study['strategies']['market'],'guarded-market':policies['market']}
    for model,p in policies.items():
        p['gates']={ref:engine.gates(p,r) for ref,r in references.items()}
        p['practicalCandidate']=all(g['higherReturn'] or g['defensiveTradeoff'] for g in p['gates'].values());p['confirmedEdge']=False
    start=study['calendarStartIndex'];n=len(cal)-1-start;rng=np.random.default_rng(20261022);starts=rng.integers(0,n,size=(2500,int(np.ceil(n/52))))
    ix=((starts[:,:,None]+np.arange(52))%n).reshape(2500,-1)[:,:n];cash=np.array([r['cashReturn'] for r in cal[start:-1]])
    paths=json.loads((ROOT/study['policyPathReceipt']['path'].lstrip('/')).read_text())['rows']
    cols=risk['policyColumns'];return_at=cols.index('return');tests=[]
    for model in ['vix','stress']:
        a=policies[model]
        for reference in ['past52','market','guarded-market']:
            b=references[reference];br=np.array([r['return'] for r in b['rows']]) if 'rows' in b else np.array([r[return_at] for r in paths[reference]])
            t={'model':model,'reference':reference,**engine.paired(np.array([r['return'] for r in a['rows']]),br,cash,ix)}
            t['foldGains']={label:a['folds'][label]['annualMeanExcess']-b['folds'][label]['annualMeanExcess'] for label in a['folds']};tests.append(t)
    last=0.
    for rank,t in enumerate(sorted(tests,key=lambda t:t['p'])):last=min(1.,max(last,(6-rank)*t['p']));t['holmP']=last
    for m in ['vix','stress']:
        p=policies[m];mine=[t for t in tests if t['model']==m]
        p['strongerSupport']=bool(p['practicalCandidate'] and all(t['lower95']>0 and t['holmP']<.05 and all(v>0 for v in t['foldGains'].values()) for t in mine))
    output={'version':'risk-guard-research-8','asOf':risk['asOf'],'confirmedEdge':False,'procedureCount':6,'horizon':4,
        'protocolSha256':engine.sha(HERE/'protocol.md'),'riskInputSha256':engine.sha(ROOT/'data/risk-research.json'),
        'recoveryInputSha256':engine.sha(ROOT/'data/recovery-research.json'),'pathReceipt':study['policyPathReceipt'],
        'startIndex':start,'strategies':policies,'primaryComparisons':tests,'modelLabels':risk['modelLabels'],
        'referenceLabels':{'past52':'Original past52 cap','market':'Original fitted past-risk policy','guarded-market':'Guarded fitted past-risk policy'},
        'limitations':['This guard was declared after the initial risk and strategy results; all history was already inspected.',
            'A practical defensive tradeoff permits at most 0.5pp lower CAGR for at least 20% smaller drawdown, higher Sharpe and comparable risk.',
            'Risk estimates do not guarantee realized risk; drawdowns use daily closes and exclude intraday losses.',
            'Six-test correction is local to this round; earlier attempts and small effective crisis counts remain relevant.',
            'No live transaction is placed; issued forecasts and earlier studies remain unchanged.']}
    WORK.mkdir(exist_ok=True,parents=True);(WORK/'research-candidate.json').write_text(json.dumps(engine.safe(output),separators=(',',':'),allow_nan=False))
    (WORK/'bootstrap-starts.json').write_text(json.dumps(starts.tolist(),separators=(',',':')))
    print(json.dumps(engine.safe({'strategies':{m:{k:p[k] for k in ['cagr','volatility','maxDrawdown','sharpe','gates','practicalCandidate']} for m,p in policies.items()},'comparisons':tests})),flush=True)
    return output
if __name__=='__main__':build()
