"""Separate rolling-memory extension; original 41 procedures stay unchanged."""
import json
from copy import deepcopy
import numpy as np
import pandas as pd
import experiment as lab


def build():
    data=json.loads((lab.WORK/'research-candidate.json').read_text());cal=json.loads((lab.WORK/'private-calendar.json').read_text())
    (lab.WORK/'initial-candidate.json').write_text(json.dumps(data,separators=(',',':')))
    spy=lab.source.price_rows(json.loads((lab.ROOT/'work/research-v5/spy-daily.json').read_text()),'SPY',data['asOf'])
    f=pd.DataFrame(spy);f['week']=pd.to_datetime(f.date).dt.to_period('W-FRI');w=f.groupby('week').tail(1).set_index('week').adjusted
    short=w.pct_change(fill_method=None).rolling(13,min_periods=13).std(ddof=1)*np.sqrt(52)
    extension={'protocolSha256':lab.sha(lab.HERE/'memory-protocol.md'),'procedureCount':10,'calendar':[],'riskEstimates':{},'primaryComparisons':[]}
    for i,r in enumerate(cal):
        r['recentStress']=any(p['complete'] and p['level']>=2 for p in cal[max(0,i-26):i+1])
        r['shortVol']=float(short[pd.Period(r['week'],freq='W-FRI')])
        extension['calendar'].append({'i':i,'recentStress':r['recentStress'],'shortVol':r['shortVol']})
    for risk in ['slow','responsive']:
        clock=deepcopy(cal)
        for r in clock:
            if risk=='responsive':r['riskCap']=min(1.,.1/max(r['pastVol'],r['shortVol']))
        strategies={}
        for key in ['market','trend','fast','memory-price','memory-recovery']:
            alt=deepcopy(clock)
            for r in alt:
                if key=='fast':r['gap40']=1. if r['gap40']>0 or r['gap10']>0 else -1.
                elif key.startswith('memory-'):
                    early=r['recentStress'] and r['gap10']>0 and (key=='memory-price' or r['stressImproving'])
                    r['gap40']=1. if r['gap40']>0 or early else -1.
            s=lab.policy(alt,spy,0,'market' if key=='market' else 'trend',[])
            s.update({'label':{'market':'Risk-capped SPY','trend':'40-week trend only','fast':'10- or 40-week price trend','memory-price':'Stress memory + price trend','memory-recovery':'Stress memory + VIX/HY + price'}[key],'kind':key,'rule':None})
            # Preserve the actual original core state, not the effective rule flag.
            for row in s['rows']:row['coreOn']=cal[row['i']]['gap40']>0
            strategies[key]=s
        for key in ['memory-price','memory-recovery']:
            s=strategies[key];s['gates']={ref:lab.gates(s,strategies[ref]) for ref in ['market','trend','fast']}
            s['economicCandidate']=all(g['higherReturn'] for g in s['gates'].values());s['defensiveCandidate']=all(g['defensiveTradeoff'] for g in s['gates'].values());s['confirmedEdge']=False
        extension['riskEstimates'][risk]={'strategies':strategies}
        print(json.dumps({'risk':risk,'results':{k:{f:v.get(f) for f in ['cagr','sharpe','volatility','maxDrawdown','economicCandidate','defensiveCandidate']} for k,v in strategies.items()}}),flush=True)
    starts=np.array(json.loads((lab.WORK/'bootstrap-starts.json').read_text()));n=len(cal)-1
    ix=((starts[:,:,None]+np.arange(52))%n).reshape(2500,-1)[:,:n];cash=np.array([r['cashReturn'] for r in cal[:-1]])
    for risk,study in extension['riskEstimates'].items():
        s=study['strategies'];a=s['memory-recovery']
        for ref in ['market','trend','fast','memory-price']:
            b=s[ref];t={'risk':risk,'model':'memory-recovery','reference':ref,**lab.paired(np.array([r['return'] for r in a['rows']]),np.array([r['return'] for r in b['rows']]),cash,ix)}
            t['foldGains']={label:a['folds'][label]['annualMeanExcess']-b['folds'][label]['annualMeanExcess'] for label in a['folds']};extension['primaryComparisons'].append(t)
    prior=0.
    for rank,c in enumerate(sorted(extension['primaryComparisons'],key=lambda c:c['p'])):
        prior=min(1.,max(prior,(8-rank)*c['p']));c['holmP']=prior
    for risk,study in extension['riskEstimates'].items():
        a=study['strategies']['memory-recovery'];tests=[t for t in extension['primaryComparisons'] if t['risk']==risk]
        a['strongerRetrospectiveSupport']=bool((a['economicCandidate'] or a['defensiveCandidate']) and all(t['lower95']>0 and t['holmP']<.05 and all(v>0 for v in t['foldGains'].values()) for t in tests))
    data['memory']=extension;data['initialCandidateSha256']=lab.sha(lab.WORK/'initial-candidate.json');data['totalProcedureCount']=51
    (lab.WORK/'research-candidate.json').write_text(json.dumps(lab.safe(data),separators=(',',':'),allow_nan=False))
    print(json.dumps({'comparisons':extension['primaryComparisons']}),flush=True)
if __name__=='__main__':build()
