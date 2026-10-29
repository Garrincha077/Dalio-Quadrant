"""Continuous stress return forecasts with strictly mature earlier labels."""
import importlib.util
import json
from pathlib import Path
import numpy as np
import pandas as pd
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];WORK=ROOT/'work/research-v9'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
engine=module('return_policy_engine',HERE.parent/'v6/experiment.py')
risk_math=module('return_maturity_engine',HERE.parent/'v7/experiment.py')
MODELS={'mean':[],'market':list(range(4)),'stress':list(range(7)),'price':list(range(8)),'full':list(range(13))}
LABELS={'mean':'Earlier mean excess return','market':'Past-price return model','stress':'Price + RSI/VIX/HY return model','price':'Stress + price z','full':'Stress + price/value + macro'}

def fit_predict(x,y,current,names):
    mu=x.mean(axis=0);sd=x.std(axis=0,ddof=1);sd=np.where(sd>1e-12,sd,1.);z=np.clip((x-mu)/sd,-5,5);q=np.clip((current-mu)/sd,-5,5);intercept=y.mean();cross=z.T@(y-intercept);gram=z.T@z
    pred={};details={}
    for name in names:
        cols=MODELS[name];beta=np.linalg.solve(gram[np.ix_(cols,cols)]+100*np.eye(len(cols)),cross[cols]) if cols else np.array([])
        raw=float(intercept+q[cols]@beta);pred[name]=float(np.clip(raw,-.5,.5));details[name]={'coefficients':beta.tolist(),'boundHit':bool(raw<-.5 or raw>.5)}
    return pred,{'means':mu.tolist(),'sds':sd.tolist(),'intercept':float(intercept),'models':details}

def utility_weight(expected,variance,cap):
    if expected is None or variance is None or not np.isfinite(expected) or not np.isfinite(variance) or variance<=0:return 0.
    return min(cap,max(0.,expected/(3*variance)))

def summary(rows,model,cal):
    a=[r for r in rows if r['target'] is not None];y=np.array([r['target'] for r in a]);p=np.array([r['predictions'][model] for r in a]);base=np.array([r['predictions']['mean'] for r in a]);error=p-y
    return {'n':len(a),'first':cal[a[0]['i']]['week'] if a else None,'last':cal[a[-1]['i']]['week'] if a else None,
        'mse':float(np.mean(error**2)) if len(a) else None,'mae':float(np.mean(abs(error))) if len(a) else None,
        'bias':float(error.mean()) if len(a) else None,'directionAccuracy':float(np.mean((p>0)==(y>0))) if len(a) else None,
        'r2VsMean':float(1-np.sum(error**2)/np.sum((base-y)**2)) if len(a) else None,'boundHits':sum(r['boundHits'][model] for r in rows)}

def build():
    risk=json.loads((ROOT/'data/risk-research.json').read_text());recovery=json.loads((ROOT/'data/recovery-research.json').read_text());cal=json.loads((ROOT/'work/research-v6/private-calendar.json').read_text())
    assert risk['audit']['status']=='Independent refits and reconstruction passed'
    near={r['i']:r['predictions']['vix'] for r in risk['horizons']['4']['main']['forecasts']};short=[r['shortVol'] for r in recovery['memory']['calendar']]
    index=engine.source.price_rows(json.loads((ROOT/'work/research-v5/sp500-daily.json').read_text()),'^GSPC',risk['asOf']);f=pd.DataFrame(index);f['week']=pd.to_datetime(f.date).dt.to_period('W-FRI');w=f.groupby('week').tail(1).set_index('week').close
    ret13=np.log(w/w.shift(13));ret52=np.log(w/w.shift(52));x=[]
    for i,r in enumerate(cal):
        p=pd.Period(r['week'],freq='W-FRI');x.append([ret13[p],ret52[p],np.log(short[i]**2),np.log(r['pastVol']**2),r['rsi']/100-.5,
            np.log((r['vix']/100)**2) if r['vix'] and r['vix']>0 else None,np.log(r['hy']) if r['hy'] and r['hy']>0 else None,
            r['priceZ'],r['valueZ'],r['context']['activity'],r['context']['inflationGap'],r['growth'],r['inflation']])
    x=np.array(x,float);market=np.array([r['marketReturn'] for r in cal[:-1]]);cash=np.array([r['cashReturn'] for r in cal[:-1]])
    y=np.array([np.prod(1+market[i:i+52])-np.prod(1+cash[i:i+52]) if i+52<len(cal) else np.nan for i in range(len(cal))])
    maturity=[cal[i+52]['executionDate'] if i+52<len(cal) else None for i in range(len(cal))]
    spy=engine.source.price_rows(json.loads((ROOT/'work/research-v5/spy-daily.json').read_text()),'SPY',risk['asOf'])
    output={'version':'return-research-9','asOf':risk['asOf'],'confirmedEdge':False,'horizon':52,'procedureCount':12,'policyProcedureCount':30,
        'protocolSha256':engine.sha(HERE/'protocol.md'),'riskInputSha256':engine.sha(ROOT/'data/risk-research.json'),'recoveryInputSha256':engine.sha(ROOT/'data/recovery-research.json'),
        'modelLabels':LABELS,'cohorts':{},'predictionComparisons':[],'policyComparisons':[],
        'limitations':['All prior regimes and many related experiments were inspected before this round; this is not a fresh holdout.',
            'One-year target labels overlap across weekly starts and share a small number of independent crises.',
            'The expected annual excess return and near-term VIX risk forecast have different horizons; utility allocation is a declared heuristic.',
            'Directional accuracy is retrospective classification, not a calibrated probability of profit.',
            'Risk/cost/cash assumptions match earlier studies; realized risk and intraday losses are not guaranteed.',
            'Corrections apply only to this declared round; earlier trials and source-vintage limits remain relevant.']}
    audit={};draws={}
    for cohort,width,names in [('main',7,list(MODELS)[:3]),('price',8,list(MODELS)[:4]),('context',13,list(MODELS))]:
        xx=x[:,:width];eligible=np.isfinite(xx).all(axis=1);rows=[];fits=[]
        for i,r in enumerate(cal):
            if not eligible[i] or i not in near:continue
            train=risk_math.mature_training(eligible,maturity,y,r['cutoff'],i)
            if len(train)<156:continue
            predictions,detail=fit_predict(xx[train],y[train],xx[i],names)
            rows.append({'i':i,'trainingCount':len(train),'lastTrainingMaturity':maturity[train[-1]],'target':float(y[i]) if np.isfinite(y[i]) else None,
                'maturityDate':maturity[i],'nearTermVariance':near[i],'predictions':predictions,'boundHits':{m:detail['models'][m]['boundHit'] for m in names}})
            fits.append({'i':i,'training':train.tolist(),'currentFeatures':xx[i].tolist(),**detail})
        lookup={r['i']:r for r in rows};first=rows[0]['i'];strategies={};summaries={}
        for model in names:
            summaries[model]=summary(rows,model,cal);summaries[model]['folds']={}
            for mode in ['sign','utility']:
                clock=[]
                for r in cal:
                    p=lookup.get(r['i']);weight=0.
                    if p:weight=r['riskCap'] if mode=='sign' and p['predictions'][model]>0 else utility_weight(p['predictions'][model],p['nearTermVariance'],r['riskCap']) if mode=='utility' else 0.
                    clock.append(dict(r,riskCap=weight))
                s=engine.policy(clock,spy,first,'market',[]);s.update({'kind':mode,'rule':model,'label':LABELS[model]});strategies[f'{mode}:{model}']=s
            for label,begin,end in engine.FOLDS:
                sub=[r for r in rows if begin<=cal[r['i']]['week'][:4]<end]
                if sub:summaries[model]['folds'][label]=summary(sub,model,cal)
        for key in ['passive','risk-only']:
            clock=[dict(r,riskCap=r['riskCap'] if key=='passive' else min(r['riskCap'],.1/np.sqrt(near[r['i']])) if r['i'] in near else 0.) for r in cal]
            s=engine.policy(clock,spy,first,'market',[]);s.update({'kind':key,'rule':None,'label':'Past52 risk-capped SPY' if key=='passive' else 'VIX risk only, without return forecast'});strategies[key]=s
        for key,s in strategies.items():
            if ':' not in key:continue
            mode=key.split(':')[0];s['gates']={ref:engine.gates(s,strategies[ref]) for ref in [f'{mode}:mean',f'{mode}:market','passive','risk-only']}
            s['practicalCandidate']=all(g['higherReturn'] or g['defensiveTradeoff'] for g in s['gates'].values());s['confirmedEdge']=False
        output['cohorts'][cohort]={'first':cal[first]['week'],'last':cal[-1]['week'],'calendarStartIndex':first,'models':names,'forecasts':rows,'summaries':summaries,'strategies':strategies,
            'holdingIntervals':len(cal)-1-first,'cashFallbackIntervals':sum(i not in lookup for i in range(first,len(cal)-1))};audit[cohort]=fits
        print(json.dumps({'cohort':cohort,'mse':{m:s['mse'] for m,s in summaries.items()},'cagr':{k:s['cagr'] for k,s in strategies.items()},'candidates':[k for k,s in strategies.items() if s.get('practicalCandidate')]}),flush=True)
    study=output['cohorts']['main'];first=study['calendarStartIndex'];length=len(cal)-first;rng=np.random.default_rng(20261022)
    starts=rng.integers(0,length,size=(2500,int(np.ceil(length/52))));draws['prediction']=starts.tolist();loss={m:np.full(length,np.nan) for m in study['models']}
    for r in study['forecasts']:
        if r['target'] is not None:
            for m in study['models']:loss[m][r['i']-first]=(r['target']-r['predictions'][m])**2
    for ref in ['mean','market']:
        t={'model':'stress','reference':ref,**risk_math.block_test(loss[ref],loss['stress'],starts),'foldGains':{}}
        for label in study['summaries']['stress']['folds']:
            a=study['summaries']['stress']['folds'][label];b=study['summaries'][ref]['folds'][label]
            if a['n']:t['foldGains'][label]=b['mse']-a['mse']
        output['predictionComparisons'].append(t)
    n=length-1;rng=np.random.default_rng(20261022);starts=rng.integers(0,n,size=(2500,int(np.ceil(n/52))));draws['policy']=starts.tolist();ix=((starts[:,:,None]+np.arange(52))%n).reshape(2500,-1)[:,:n]
    for mode in ['sign','utility']:
        a=study['strategies'][f'{mode}:stress']
        for ref in [f'{mode}:mean',f'{mode}:market','passive','risk-only']:
            b=study['strategies'][ref];t={'model':f'{mode}:stress','reference':ref,**engine.paired(np.array([r['return'] for r in a['rows']]),np.array([r['return'] for r in b['rows']]),cash[first:],ix)}
            t['foldGains']={label:a['folds'][label]['annualMeanExcess']-b['folds'][label]['annualMeanExcess'] for label in a['folds']};output['policyComparisons'].append(t)
    for family in ['predictionComparisons','policyComparisons']:
        last=0.;tests=output[family]
        for rank,t in enumerate(sorted(tests,key=lambda t:t.get('p',1))):
            if t.get('available',True):last=min(1.,max(last,(len(tests)-rank)*t['p']));t['holmP']=last
    for mode in ['sign','utility']:
        s=study['strategies'][f'{mode}:stress'];tests=[t for t in output['policyComparisons'] if t['model']==f'{mode}:stress']
        s['strongerSupport']=bool(s['practicalCandidate'] and all(t['lower95']>0 and t['holmP']<.05 and all(v>0 for v in t['foldGains'].values()) for t in tests))
    WORK.mkdir(exist_ok=True,parents=True);(WORK/'research-candidate.json').write_text(json.dumps(engine.safe(output),separators=(',',':'),allow_nan=False));(WORK/'private-fits.json').write_text(json.dumps(engine.safe(audit),separators=(',',':'),allow_nan=False));(WORK/'bootstrap-starts.json').write_text(json.dumps(draws,separators=(',',':')))
    return output
if __name__=='__main__':build()
