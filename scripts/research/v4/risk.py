"""Separate predeclared second-moment forecasting experiment."""
import json
from pathlib import Path

import numpy as np
import pandas as pd

import experiment as lab


def risk_inputs(markets,realised,cash):
    result=np.full((*markets.shape[:2],6),np.nan)
    result[:,:,:4]=markets
    for t in range(len(markets)):
        for j,h in enumerate([3,12]):
            if t-h-1<0:continue
            r=realised[t-h-1:t-1]-cash[t-h-1:t-1,None]
            if len(r)==h and np.isfinite(r).all():
                result[t,:,4+j]=np.sqrt(12*np.mean(r*r,axis=0))
    return result


def risk_labels(realised,cash,clock,h):
    y=np.full_like(realised,np.nan);end=np.full(len(clock),np.datetime64('NaT'),dtype='datetime64[ns]')
    for t in range(len(clock)-h):
        if clock[t+h]!=clock[t]+h:continue
        r=realised[t:t+h]-cash[t:t+h,None]
        if len(r)==h and np.isfinite(r).all():
            values=12*np.mean(r*r,axis=0)
            if np.all(values>0):
                y[t]=values;end[t]=(clock[t]+h).end_time.normalize().to_datetime64()
    return y,end


def qlike(predictions,actual):
    with np.errstate(invalid='ignore',divide='ignore'):
        return np.mean(actual/predictions+np.log(predictions),axis=-1)


def select(configs,predictions,actual,end,cutoffs):
    losses=qlike(predictions,actual)
    families=[f for f in lab.FAMILIES[:3] if any(c['family']==f for c in configs)]
    selected={m:np.full_like(actual,np.nan) for m in [*families,'adaptive']}
    choices={m:[] for m in selected}
    for t in range(len(actual)):
        if not np.isfinite(predictions[:,t]).all():continue
        history=lab.selection_indices(predictions,actual,end,cutoffs[t])
        if len(history)<24:continue
        quality=losses[:,history].mean(axis=1)
        for model in selected:
            allowed=[i for i,c in enumerate(configs) if model=='adaptive' or c['family']==model]
            best=min(allowed,key=lambda i:(round(float(quality[i]),12),i))
            selected[model][t]=predictions[best,t]
            choices[model].append({'index':t,'candidate':configs[best]['id'],
                'selectionCount':len(history),'selectionLast':int(history[-1]),'selectionQLIKE':float(quality[best])})
    return selected,choices


def risk_weights(prediction,vol,prices,clock,t):
    cash=np.r_[1.,np.zeros(5)]
    if not np.isfinite(prediction).all() or np.any(prediction<=0):return cash
    forecast=np.clip(np.sqrt(prediction),.5*vol,2*vol)
    target=1/forecast;target/=target.sum()
    changes=[]
    for a in lab.ASSETS:
        p=prices[a].reindex(pd.period_range(clock[t]-37,clock[t]-1,freq='M'))
        r=p.pct_change(fill_method=None).iloc[1:].to_numpy()
        if len(r)!=36 or not np.isfinite(r).all():return cash
        changes.append(r)
    correlation=np.corrcoef(np.array(changes))
    covariance=correlation*np.outer(forecast,forecast)
    portfolio_vol=float(np.sqrt(target@covariance@target))
    if not np.isfinite(portfolio_vol) or portfolio_vol<=1e-10:return cash
    risky=target*min(1.,.10/portfolio_vol)
    return np.r_[1-risky.sum(),risky]


def strategy(prediction,vols,prices,clock,realised,cash,mask):
    weights=np.array([risk_weights(p,v,prices,clock,t) for t,(p,v) in enumerate(zip(prediction,vols))])
    return lab.engine.evaluate_strategy(weights,realised,cash,mask,clock)


def run(h,base,frame,clock,prices):
    markets=risk_inputs(np.array(base['markets'],float),np.array(base['realised'],float),np.array(base['cash'],float))
    macro=np.array(base['macro'],float);vols=np.array(base['vols'],float)
    realised=np.array(base['realised'],float);cash=np.array(base['cash'],float)
    eligible=np.isfinite(markets).all(axis=(1,2))&np.isfinite(macro).all(axis=1)
    y,end=risk_labels(realised,cash,clock,h)
    with np.errstate(invalid='ignore',divide='ignore'):
        target=np.log(y/vols**2)
    xs={f:lab.matrices(markets,macro,None,None,f) for f in lab.FAMILIES[:3]}
    configs=[lab.configuration(f,a,w) for f in lab.FAMILIES[:3] for a,w in lab.SETTINGS]
    logpred=lab.fit_candidates(configs,xs,eligible,target,end,frame.cutoff.tolist())
    pred=vols[None]**2*np.exp(logpred)
    selected,choices=select(configs,pred,y,end,frame.cutoff.tolist())
    ready=np.isfinite(selected['adaptive']).all(axis=1);common=ready&np.isfinite(y).all(axis=1)
    market=np.isfinite(realised).all(axis=1)&np.isfinite(cash);starts=np.flatnonzero(ready&market);mask=market.copy()
    if len(starts):mask[:starts[0]]=False
    else:mask[:]=False
    policies={m:strategy(p,vols,prices,clock,realised,cash,mask) for m,p in selected.items()}
    # Simple, directly observed past-risk comparator; no training or tuning.
    selected['past-risk']=vols**2
    policies['past-risk']=strategy(vols**2,vols,prices,clock,realised,cash,mask)
    for name,w in {'SPY':[1.,0,0,0,0],'60/40':[.6,.4,0,0,0],'Equal five':[.2]*5}.items():
        weights=np.array([lab.engine.risk_weights(np.array(w),prices,clock,t) for t in range(len(frame))])
        policies[name]=lab.engine.evaluate_strategy(weights,realised,cash,mask,clock)
    def stats(p,valid):
        ix=np.flatnonzero(valid)
        return {'n':len(ix),'first':str(clock[ix[0]]) if len(ix) else None,'last':str(clock[ix[-1]]) if len(ix) else None,
            'meanQLIKE':float(np.mean(qlike(p[ix],y[ix]))) if len(ix) else None}
    attempts=[]
    for i,c in enumerate(configs):
        p=strategy(pred[i],vols,prices,clock,realised,cash,mask);p.pop('rows',None)
        attempts.append({**c,'risk':stats(pred[i],common),'policy':p})
    lookup={m:{r['index']:r for r in rows} for m,rows in choices.items()}
    forecasts=[]
    for t in np.flatnonzero(ready):
        methods={}
        for m in choices:
            choice=lookup[m][t];c=next(c for c in configs if c['id']==choice['candidate'])
            train=lab.training_indices(eligible,target,end,frame.cutoff.iloc[t],c['window'])
            methods[m]={'candidate':c['id'],'training':len(train),'lastTrainingMaturity':str(pd.Timestamp(end[train[-1]])).split()[0],
                'selectionCount':choice['selectionCount'],'selectionLastMaturity':str(pd.Timestamp(end[choice['selectionLast']])).split()[0],
                'selectionQLIKE':choice['selectionQLIKE']}
        forecasts.append({'month':str(clock[t]),'cutoff':frame.cutoff.iloc[t],'tradeDate':frame.tradeDate.iloc[t],
            'common':bool(common[t]),'predictions':{m:p[t].tolist() for m,p in selected.items()},'outcomes':y[t].tolist(),'methods':methods})
    folds={}
    for label,condition in {'Through 2019':clock.year<=2019,'2020–2022':(clock.year>=2020)&(clock.year<=2022),
        '2023 onward':clock.year>=2023}.items():
        f=common&condition
        if f.any():folds[label]={m:stats(p,f) for m,p in selected.items()}
    comparisons=[];ix=np.flatnonzero(common)
    for model in ['adaptive','interaction']:
        lo,hi=ix[0],ix[-1]+1
        a=np.where(common,qlike(selected['market'],y),np.nan)[lo:hi]
        b=np.where(common,qlike(selected[model],y),np.nan)[lo:hi]
        pa,pb=policies[model],policies['market']
        comparisons.append({'model':model,'against':'market','prediction':lab.bootstrap_ic(a,b,h),
            'policy':lab.bootstrap_pair(np.array([r['return'] for r in pa['rows']]),np.array([r['return'] for r in pb['rows']]),12,True,np.array([r['cash'] for r in pa['rows']])),
            'economicGates':{'higherNetCAGR':pa['cagr']>pb['cagr'],'comparableRisk':pa['volatility']<=1.1*pb['volatility'],
                'drawdownNoWorse':pa['maxDrawdown']>=pb['maxDrawdown']},
            'foldGains':{k:v['market']['meanQLIKE']-v[model]['meanQLIKE'] for k,v in folds.items()}})
    result={'horizon':h,'models':{m:stats(p,common) for m,p in selected.items()},'configurations':18,'attempts':attempts,
        'coverage':{'decisions':len(frame),'completeInputs':int(eligible.sum()),'commonStarts':int(common.sum()),
            'holdingMonths':int(mask.sum()),'cashFallbackMonths':int((mask&~ready).sum())},
        'forecastRows':forecasts,'strategies':policies,'folds':folds,'comparisons':comparisons,
        'selectionCounts':{m:dict(pd.Series([r['candidate'] for r in rows]).value_counts()) for m,rows in choices.items()}}
    private={'markets':markets,'configurations':configs,'eligible':eligible,'targets':y,'logTargets':target,'end':end.astype(str).tolist(),
        'predictions':pred,'logPredictions':logpred,'selected':selected,'choices':choices,'marketMask':mask}
    return result,private


def build():
    output=json.loads((lab.WORK/'research-candidate.json').read_text());base=json.loads((lab.WORK/'private-audit.json').read_text())
    frame=pd.DataFrame(json.loads((lab.BASE/'features.json').read_text())['rows']);clock=pd.PeriodIndex(frame.tradeDate,freq='M')
    prices={a:lab.engine.load_prices(lab.BASE/f'prices/{a}.csv',output['asOf']) for a in lab.ASSETS}
    output['risk']={};base['risk']={}
    for h in [3,12]:
        public,private=run(h,base,frame,clock,prices)
        output['risk'][str(h)]=public;base['risk'][str(h)]=private
        print(json.dumps({'riskHorizon':h,'models':public['models'],'coverage':public['coverage']}),flush=True)
    rank=[c for s in output['horizons']['12'].values() for c in s['comparisons']]
    risk=output['risk']['3']['comparisons']
    lab.engine.holm([*[c['ranking'] for c in rank],*[c['prediction'] for c in risk]])
    lab.engine.holm([c['policy'] for c in rank+risk])
    for c in rank+risk+output['risk']['12']['comparisons']:
        evidence=c.get('ranking',c.get('prediction'))
        economic=all(c['economicGates'].values())
        stronger=all(x.get('available') and x['lower95']>0 and x.get('holmP',1)<.05 for x in [evidence,c['policy']])
        stable=all(v>0 for v in c['foldGains'].values())
        c['status']='Stronger retrospective candidate' if economic and stronger and stable else 'Exploratory economic candidate' if economic else 'No economic improvement on all gates'
        c['confirmedEdge']=False
    output.update({'attemptCount':120,'rankingAttemptCount':84,'riskAttemptCount':36,'primaryPredictionComparisons':6,
        'riskProtocolSha256':lab.engine.sha(lab.HERE/'risk-protocol.md')})
    base['bootstrapDraws'].update(lab.safe(lab.BOOTSTRAP_DRAWS))
    (lab.WORK/'private-audit.json').write_text(json.dumps(lab.safe(base),separators=(',',':'),allow_nan=False))
    (lab.WORK/'research-candidate.json').write_text(json.dumps(lab.safe(output),separators=(',',':'),allow_nan=False))
    print(json.dumps({'attempts':120,'status':'awaiting-independent-verification'}),flush=True)


if __name__=='__main__':build()
