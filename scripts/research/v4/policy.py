"""Causal utility selectors over the previously declared return predictors."""
import json
import numpy as np
import pandas as pd
import experiment as lab
import risk


def earlier_holdings(mask,frame,t):
    return np.flatnonzero(mask & np.array([i+1<len(frame) and frame.tradeDate.iloc[i+1]<=frame.cutoff.iloc[t]
        for i in range(len(frame))]))[-36:]


def utility_select(configs,predictions,candidate_returns,cash,calendar,frame):
    families=[f for f in lab.FAMILIES if any(c['family']==f for c in configs)]
    selected={m:np.full_like(predictions[0],np.nan) for m in [*families,'adaptive']}
    choices={m:[] for m in selected}
    for t in range(len(frame)):
        if not np.isfinite(predictions[:,t]).all():continue
        history=earlier_holdings(calendar,frame,t)
        if len(history)<24:continue
        excess=candidate_returns[:,history]-cash[history]
        sd=excess.std(axis=1,ddof=1)
        quality=np.divide(excess.mean(axis=1),sd,out=np.full(len(configs),-np.inf),where=sd>1e-12)*np.sqrt(12)
        for model in selected:
            allowed=[i for i,c in enumerate(configs) if model=='adaptive' or c['family']==model]
            best=max(allowed,key=lambda i:(round(float(quality[i]),12),-i))
            selected[model][t]=predictions[best,t]
            choices[model].append({'index':t,'candidate':configs[best]['id'],
                'selectionCount':len(history),'selectionLast':int(history[-1]),'selectionSharpe':float(quality[best])})
    return selected,choices


def gates(a,b):
    return {'higherNetCAGR':a['cagr']>b['cagr'],'comparableRisk':a['volatility']<=1.1*b['volatility'],
        'drawdownNoWorse':a['maxDrawdown']>=b['maxDrawdown']}


def run(study,internal,base,frame,clock,prices):
    configs=internal['configurations'];pred=np.array(internal['predictions'],float)
    y=np.array(internal['targets'],float);vols=np.array(base['vols'],float)
    cash=np.array(base['cash'],float);realised=np.array(base['realised'],float)
    available=np.isfinite(pred).all(axis=(0,2));market=np.isfinite(realised).all(axis=1)&np.isfinite(cash)
    first=np.flatnonzero(available&market)[0];calendar=market.copy();calendar[:first]=False
    returns=np.full(pred.shape[:2],np.nan)
    for ci,p in enumerate(pred):
        pol=lab.policy(p,vols,prices,clock,realised,cash,calendar)
        returns[ci,calendar]=[r['return'] for r in pol['rows']]
    selected,choices=utility_select(configs,pred,returns,cash,calendar,frame)
    ready=np.isfinite(selected['adaptive']).all(axis=1);eligible=np.array(internal['eligible'])
    maturity=np.array(internal['end'],dtype='datetime64[ns]')
    selected['mean']=np.full_like(y,np.nan)
    for t in np.flatnonzero(ready):
        train=lab.training_indices(eligible,y,maturity,frame.cutoff.iloc[t]);selected['mean'][t]=y[train].mean(axis=0)
    common=ready&np.isfinite(y).all(axis=1);mask=market.copy();mask[:np.flatnonzero(ready&market)[0]]=False
    policies={m:lab.policy(p,vols,prices,clock,realised,cash,mask) for m,p in selected.items()}
    for name,w in {'SPY':[1.,0,0,0,0],'60/40':[.6,.4,0,0,0],'Equal five':[.2]*5}.items():
        weights=np.array([lab.engine.risk_weights(np.array(w),prices,clock,t) for t in range(len(frame))])
        policies[name]=lab.engine.evaluate_strategy(weights,realised,cash,mask,clock)
    inv=1/vols;inv/=inv.sum(axis=1,keepdims=True);inv[~np.isfinite(inv).all(axis=1)]=0
    policies['Inverse volatility']=lab.engine.evaluate_strategy(np.array([lab.engine.risk_weights(w,prices,clock,t) for t,w in enumerate(inv)]),realised,cash,mask,clock)
    forecasts=[];lookup={m:{r['index']:r for r in rows} for m,rows in choices.items()}
    for t in np.flatnonzero(ready):
        methods={}
        for m in choices:
            choice=lookup[m][t];c=next(c for c in configs if c['id']==choice['candidate'])
            train=lab.training_indices(eligible,y,maturity,frame.cutoff.iloc[t],c['window'])
            methods[m]={'candidate':c['id'],'training':len(train),'lastTrainingMaturity':str(pd.Timestamp(maturity[train[-1]])).split()[0],
                'selectionCount':choice['selectionCount'],'selectionLastMaturity':frame.tradeDate.iloc[choice['selectionLast']+1],
                'selectionSharpe':choice['selectionSharpe']}
        forecasts.append({'month':str(clock[t]),'cutoff':frame.cutoff.iloc[t],'tradeDate':frame.tradeDate.iloc[t],
            'common':bool(common[t]),'predictions':{m:p[t].tolist() for m,p in selected.items()},
            'outcomes':y[t].tolist(),'methods':methods})
    folds={}
    for label,start,stop in [('Through 2019','0000','2020'),('2020–2022','2020','2023'),('2023 onward','2023','9999')]:
        rows={m:[r for r in p['rows'] if start<=r['month']<stop] for m,p in policies.items()}
        if rows['market']:
            folds[label]={m:{'months':len(r),'annualMeanExcess':float(12*np.mean([x['return']-x['cash'] for x in r]))} for m,r in rows.items()}
    comparisons=[]
    for model in ['adaptive','interaction']:
        a,b=policies[model],policies['market']
        comparisons.append({'model':model,'against':'market','policy':lab.bootstrap_pair(np.array([r['return'] for r in a['rows']]),
            np.array([r['return'] for r in b['rows']]),12,True,np.array([r['cash'] for r in a['rows']])),
            'economicGates':gates(a,b),'historicalMeanGates':gates(a,policies['mean']),
            'foldGains':{k:v[model]['annualMeanExcess']-v['market']['annualMeanExcess'] for k,v in folds.items()}})
    output={'horizon':study['horizon'],'cohort':study['cohort'],'models':{m:lab.summary(p,y,common,clock) for m,p in selected.items()},
        'coverage':{'commonStarts':int(common.sum()),'holdingMonths':int(mask.sum()),'cashFallbackMonths':int((mask&~ready).sum())},
        'forecastRows':forecasts,'strategies':policies,'comparisons':comparisons,'folds':folds,
        'selectionCounts':{m:dict(pd.Series([x['candidate'] for x in rows]).value_counts()) for m,rows in choices.items()}}
    private={'candidateReturns':returns,'candidateCalendar':calendar,'selected':selected,'choices':choices,'marketMask':mask}
    return output,private


def refresh_previous(data,base):
    """Apply the fixed floating-boundary rule without refitting any predictor."""
    for is_risk,studies in [(False,[(h,c,s) for h,cohorts in data['horizons'].items() for c,s in cohorts.items()]),
        (True,[(h,'main',s) for h,s in data['risk'].items()])]:
        for h,cohort,study in studies:
            internal=base['risk'][h] if is_risk else base['studies'][h][cohort]
            y=np.array(internal['targets'],float);selected={m:np.array(p,float) for m,p in internal['selected'].items()}
            common=np.isfinite(selected['adaptive']).all(axis=1)&np.isfinite(y).all(axis=1);ix=np.flatnonzero(common)
            for c in study['comparisons']:
                if is_risk:
                    a=risk.qlike(selected['market'],y);b=risk.qlike(selected[c['model']],y)
                else:
                    a=lab.rank_ic_matrix(selected[c['model']],y);b=lab.rank_ic_matrix(selected['market'],y)
                a=np.where(common,a,np.nan)[ix[0]:ix[-1]+1];b=np.where(common,b,np.nan)[ix[0]:ix[-1]+1]
                c['prediction' if is_risk else 'ranking']=lab.bootstrap_ic(a,b,int(h))
                pa,pb=study['strategies'][c['model']],study['strategies']['market']
                c['policy']=lab.bootstrap_pair(np.array([r['return'] for r in pa['rows']]),np.array([r['return'] for r in pb['rows']]),12,True,np.array([r['cash'] for r in pa['rows']]))


def build():
    data=json.loads((lab.WORK/'research-candidate.json').read_text());base=json.loads((lab.WORK/'private-audit.json').read_text())
    frame=pd.DataFrame(json.loads((lab.BASE/'features.json').read_text())['rows']);clock=pd.PeriodIndex(frame.tradeDate,freq='M')
    prices={a:lab.engine.load_prices(lab.BASE/f'prices/{a}.csv',data['asOf']) for a in lab.ASSETS}
    data['portfolioSelection']={};base['policySelection']={}
    for h,studies in data['horizons'].items():
        data['portfolioSelection'][h]={};base['policySelection'][h]={}
        for cohort,study in studies.items():
            public,private=run(study,base['studies'][h][cohort],base,frame,clock,prices)
            data['portfolioSelection'][h][cohort]=public;base['policySelection'][h][cohort]=private
            print(json.dumps({'utilityHorizon':h,'cohort':cohort,'models':public['models'],'coverage':public['coverage']}),flush=True)
    refresh_previous(data,base)
    rank=[c for s in data['horizons']['12'].values() for c in s['comparisons']]
    r=data['risk']['3']['comparisons'];utility=[c for s in data['portfolioSelection']['12'].values() for c in s['comparisons']]
    lab.engine.holm([*[c['ranking'] for c in rank],*[c['prediction'] for c in r]])
    lab.engine.holm([c['policy'] for c in rank+r+utility])
    for h,studies in data['portfolioSelection'].items():
        for s in studies.values():
            for c in s['comparisons']:
                economic=all(c['economicGates'].values()) and all(c['historicalMeanGates'].values())
                strong=c['policy']['lower95']>0 and c['policy'].get('holmP',1)<.05 and all(v>0 for v in c['foldGains'].values())
                c['status']='Stronger retrospective candidate' if h=='12' and economic and strong else 'Exploratory economic candidate' if economic else 'No economic improvement on all gates'
                c['confirmedEdge']=False
    for c in rank+r:
        pred=c.get('ranking',c.get('prediction'));economic=all(c['economicGates'].values())
        strong=all(t.get('available') and t['lower95']>0 and t.get('holmP',1)<.05 for t in [pred,c['policy']])
        c['status']='Stronger retrospective candidate' if economic and strong and all(v>0 for v in c['foldGains'].values()) else 'Exploratory economic candidate' if economic else 'No economic improvement on all gates'
    data.update({'selectorProcedureCount':18,'primaryPolicyComparisons':10,'policyProtocolSha256':lab.engine.sha(lab.HERE/'policy-protocol.md'),
        'bootstrapBoundaryTolerance':1e-12})
    base['bootstrapDraws'].update(lab.safe(lab.BOOTSTRAP_DRAWS))
    (lab.WORK/'private-audit.json').write_text(json.dumps(lab.safe(base),separators=(',',':'),allow_nan=False))
    (lab.WORK/'research-candidate.json').write_text(json.dumps(lab.safe(data),separators=(',',':'),allow_nan=False))


if __name__=='__main__':build()
