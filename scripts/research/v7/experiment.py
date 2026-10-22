"""Causal nested forward-variance forecasts; all configured models retained."""
import importlib.util
import json
import sys
from pathlib import Path
import numpy as np
import pandas as pd
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];WORK=ROOT/'work/research-v7'
spec=importlib.util.spec_from_file_location('risk_policy_engine',HERE.parent/'v6/experiment.py')
policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
MODELS={'mean':[],'past52':[],'past13':[],'market':[0,1],'vix':[2],'stress':[0,1,2,3],
    'price':[0,1,2,3,4],'full':list(range(10))}
LABELS={'mean':'Earlier mean risk','past52':'Past 52-week risk','past13':'Past 13-week risk','market':'Fitted past-risk model',
    'vix':'VIX-only risk model','stress':'Past risk + VIX + HY','price':'Stress + price z','full':'Stress + price/value + macro'}

def matrix(cal,short):
    result=[]
    for i,r in enumerate(cal):
        values=[np.log(short[i]**2),np.log(r['pastVol']**2),np.log((r['vix']/100)**2) if r['vix'] is not None and r['vix']>0 else np.nan,
            np.log(r['hy']) if r['hy'] is not None and r['hy']>0 else np.nan,r['priceZ'],r['valueZ'],
            r['context']['activity'],r['context']['inflationGap'],r['growth'],r['inflation']]
        result.append([np.nan if v is None else v for v in values])
    return np.array(result,float)

def mature_training(eligible,maturity,target,cutoff,before):
    return np.array([j for j in range(before) if eligible[j] and maturity[j] is not None and maturity[j]<=cutoff and np.isfinite(target[j])],int)[-520:]

def fit_predict(x,y,current,models):
    if not np.isfinite(y).all() or (y<=0).any():raise ValueError("Variance targets must be positive and finite")
    mu=x.mean(axis=0);sd=x.std(axis=0,ddof=1);sd=np.where(sd>1e-12,sd,1.)
    z=np.clip((x-mu)/sd,-5,5);q=np.clip((current-mu)/sd,-5,5);logy=np.log(y);intercept=logy.mean();yc=logy-intercept
    gram=z.T@z;cross=z.T@yc;pred={};details={}
    for name in models:
        cols=MODELS[name]
        if name=='mean':raw=y.mean();detail={'coefficients':[],'calibration':None}
        elif name in ['past13','past52']:raw=np.exp(current[0 if name=='past13' else 1]);detail={'coefficients':[],'calibration':None}
        else:
            beta=np.linalg.solve(gram[np.ix_(cols,cols)]+10*np.eye(len(cols)),cross[cols])
            fitted=np.exp(intercept+z[:,cols]@beta);calibration=np.mean(y/fitted)
            raw=np.exp(intercept+q[cols]@beta)*calibration
            detail={'coefficients':beta.tolist(),'calibration':float(calibration),'intercept':float(intercept)}
        pred[name]=float(np.clip(raw,.0001,1.));details[name]={**detail,'boundHit':bool(raw<.0001 or raw>1.)}
    return pred,{'means':mu.tolist(),'sds':sd.tolist(),'models':details}

def qlike(actual,pred):
    ratio=actual/pred;return ratio-np.log(ratio)-1

def summary(rows,model,cal):
    a=[r for r in rows if r['target'] is not None];target=np.array([r['target'] for r in a]);pred=np.array([r['predictions'][model] for r in a]);loss=qlike(target,pred)
    order=np.argsort(pred,kind='stable');buckets=[]
    for ids in np.array_split(order,4):
        if len(ids):buckets.append({'n':len(ids),'meanPredictedVolatility':float(np.sqrt(pred[ids]).mean()),'observedVolatility':float(np.sqrt(target[ids].mean()))})
    return {'n':len(a),'first':cal[a[0]['i']]['week'] if a else None,'last':cal[a[-1]['i']]['week'] if a else None,
        'meanQLIKE':float(loss.mean()) if len(a) else None,'volatilityMAE':float(np.abs(np.sqrt(pred)-np.sqrt(target)).mean()) if len(a) else None,
        'actualPredictedRatio':float(np.mean(target/pred)) if len(a) else None,'buckets':buckets,'boundHits':sum(r['boundHits'][model] for r in rows)}

def block_test(a,b,starts):
    diff=a-b;valid=np.isfinite(diff);n=int(valid.sum())
    if n<104:return {'available':False,'n':n,'reason':'Insufficient paired mature starts'}
    observed=np.nanmean(diff);length=len(diff);ix=((starts[:,:,None]+np.arange(52))%length).reshape(len(starts),-1)[:,:length]
    with np.errstate(invalid='ignore'):draws=np.nanmean(diff[ix],axis=1)
    draws=draws[np.isfinite(draws)];p=(1+np.count_nonzero(np.abs(draws-observed)>=abs(observed)-1e-12))/(len(draws)+1)
    return {'available':True,'n':n,'difference':float(observed),'lower95':float(np.quantile(draws,.025)),
        'upper95':float(np.quantile(draws,.975)),'p':float(p),'replications':len(draws),'blockWeeks':52}

def build():
    WORK.mkdir(exist_ok=True,parents=True)
    base=json.loads((ROOT/'data/recovery-research.json').read_text());cal=json.loads((ROOT/'work/research-v6/private-calendar.json').read_text())
    assert base['audit']['status']=='Independent reconstruction passed'
    short=np.array([r['shortVol'] for r in base['memory']['calendar']]);x=matrix(cal,short)
    spy=policy.source.price_rows(json.loads((ROOT/'work/research-v5/spy-daily.json').read_text()),'SPY',base['asOf'])
    realised=np.array([r['marketReturn'] for r in cal[:-1]],float)
    cohorts={'main':list(MODELS)[:6],'price':list(MODELS)[:7],'context':list(MODELS)}
    output={'version':'risk-research-7','asOf':base['asOf'],'protocolSha256':policy.sha(HERE/'protocol.md'),
        'recoveryInputSha256':policy.sha(ROOT/'data/recovery-research.json'),'confirmedEdge':False,'procedureCount':63,
        'modelLabels':LABELS,'horizons':{},'primaryComparisons':[],'limitations':[
            'Predicting variance does not predict the sign of returns, identify a market bottom or prove return alpha.',
            'All historical regimes were inspected earlier; comparisons are retrospective and related.',
            'Targets overlap across weekly starts; block tests do not create additional independent crises.',
            'Older HY/VIX are retrospective archives, with original-vintage precedence retained where available.',
            'Variance forecasts are bounded to 1%–100% annual volatility; realized portfolio risk is not guaranteed.',
            'Portfolio policies rebalance weekly using the declared multiweek risk forecast, with actual cash and costs.',
            'The ten-test adjustment covers this round only and does not erase earlier model attempts.']}
    audit={};draws={}
    for h in [4,13,52]:
        output['horizons'][str(h)]={};audit[str(h)]={}
        target=np.array([52*np.mean(realised[i:i+h]**2) if i+h<=len(realised) else np.nan for i in range(len(cal))])
        maturity=[cal[i+h]['executionDate'] if i+h<len(cal) else None for i in range(len(cal))]
        for cohort,models in cohorts.items():
            width=4 if cohort=='main' else 5 if cohort=='price' else 10;xx=x[:,:width];eligible=np.isfinite(xx).all(axis=1)
            rows=[];internal=[]
            for i,r in enumerate(cal):
                if not eligible[i]:continue
                train=mature_training(eligible,maturity,target,r['cutoff'],i)
                if len(train)<104:continue
                predictions,detail=fit_predict(xx[train],target[train],xx[i],models)
                rows.append({'i':i,'trainingCount':len(train),'lastTrainingMaturity':maturity[train[-1]],
                    'target':float(target[i]) if np.isfinite(target[i]) else None,'maturityDate':maturity[i],
                    'predictions':predictions,'boundHits':{m:detail['models'][m]['boundHit'] for m in models}})
                internal.append({'i':i,'training':train.tolist(),**detail})
            first=rows[0]['i'];lookup={r['i']:r for r in rows};strategies={};summaries={}
            for model in models:
                alt=[dict(r,riskCap=min(1.,.1/np.sqrt(lookup[r['i']]['predictions'][model])) if r['i'] in lookup else 0.) for r in cal]
                s=policy.policy(alt,spy,first,'market',[]);s['label']=LABELS[model];s['kind']='forecast-risk';strategies[model]=s
                summaries[model]=summary(rows,model,cal);summaries[model]['folds']={}
                for label,start,end in policy.FOLDS:
                    sub=[r for r in rows if start<=cal[r['i']]['week'][:4]<end]
                    if sub:summaries[model]['folds'][label]=summary(sub,model,cal)
            study={'first':cal[first]['week'],'last':cal[-1]['week'],'models':models,'forecasts':rows,'summaries':summaries,'strategies':strategies,
                'calendarStartIndex':first,'holdingIntervals':len(cal)-1-first,'cashFallbackIntervals':sum(i not in lookup for i in range(first,len(cal)-1))}
            output['horizons'][str(h)][cohort]=study;audit[str(h)][cohort]=internal
            print(json.dumps({'horizon':h,'cohort':cohort,'matureStarts':summaries['mean']['n'],
                'losses':{m:s['meanQLIKE'] for m,s in summaries.items()},'cagr':{m:s['cagr'] for m,s in strategies.items()}}),flush=True)
        if h in [4,52]:
            study=output['horizons'][str(h)]['main'];length=len(cal)-study['calendarStartIndex'];rng=np.random.default_rng(20261022)
            starts=rng.integers(0,length,size=(2500,int(np.ceil(length/52))));draws[str(h)]=starts.tolist()
            loss={m:np.full(length,np.nan) for m in study['models']}
            for r in study['forecasts']:
                if r['target'] is not None:
                    for m in study['models']:loss[m][r['i']-study['calendarStartIndex']]=qlike(r['target'],r['predictions'][m])
            for model,ref in [('stress','market'),('stress','past13'),('stress','past52'),('stress','vix'),('vix','market')]:
                t={'horizon':h,'model':model,'reference':ref,**block_test(loss[ref],loss[model],starts),'foldGains':{}}
                for label in study['summaries'][model]['folds']:
                    a=study['summaries'][model]['folds'][label];b=study['summaries'][ref]['folds'][label]
                    if a['n']:t['foldGains'][label]=b['meanQLIKE']-a['meanQLIKE']
                output['primaryComparisons'].append(t)
    last=0.
    for rank,t in enumerate(sorted(output['primaryComparisons'],key=lambda t:t.get('p',1))):
        if t['available']:last=min(1.,max(last,(10-rank)*t['p']));t['holmP']=last
    for h in [4,52]:
        tests=[t for t in output['primaryComparisons'] if t['horizon']==h]
        strong=lambda t:t.get('available') and t['lower95']>0 and t['holmP']<.05 and all(v>0 for v in t['foldGains'].values())
        output['horizons'][str(h)]['main']['strongerRiskSupport']=all(strong(t) for t in tests if t['model']=='stress' and t['reference']!='vix')
        output['horizons'][str(h)]['main']['incrementalHYSupport']=all(strong(t) for t in tests if t['model']=='stress')
        output['horizons'][str(h)]['main']['vixVsMarketSupport']=all(strong(t) for t in tests if t['model']=='vix')
    (WORK/'research-candidate.json').write_text(json.dumps(policy.safe(output),separators=(',',':'),allow_nan=False))
    (WORK/'private-fits.json').write_text(json.dumps(policy.safe(audit),separators=(',',':'),allow_nan=False))
    (WORK/'bootstrap-starts.json').write_text(json.dumps(draws,separators=(',',':')))
    print(json.dumps({'primary':output['primaryComparisons']}),flush=True)
    return output
if __name__=='__main__':build()
