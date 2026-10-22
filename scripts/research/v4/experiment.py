"""Bounded, fully disclosed causal model search; earlier studies stay frozen."""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work/research-v4'
BASE = ROOT / 'work/research-v2'
spec = importlib.util.spec_from_file_location('v4_v2_engine', HERE.parent / 'v2/backtest.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
ASSETS = engine.ASSETS
FAMILIES = ['market', 'macro', 'interaction', 'value-price']
LABELS = {'mean': 'Historical average', 'market': 'Selected market trend + risk',
    'macro': 'Selected market + macro changes', 'interaction': 'Selected macro interactions',
    'value-price': 'Selected interactions + value/price', 'adaptive': 'Adaptive family selector'}
SETTINGS = [(a, w) for a in [100, 1000, 10] for w in [0, 120]]
BOOTSTRAP_DRAWS = {}


def safe(value):
    if isinstance(value,dict):return {k:safe(v) for k,v in value.items()}
    if isinstance(value,(tuple,list,np.ndarray)):return [safe(v) for v in value]
    if isinstance(value,np.bool_):return bool(value)
    return engine.safe(value)


def configuration(family, alpha, window):
    return {'id': f'{family}:r{alpha}:w{window or "all"}', 'family': family,
        'alpha': alpha, 'window': window}


def market_features(prices, clock, frame):
    markets, vols = np.full((len(clock), 5, 4), np.nan), np.full((len(clock), 5), np.nan)
    for t, month in enumerate(clock):
        for a, asset in enumerate(ASSETS):
            p = prices[asset].reindex(pd.period_range(month-37, month-1, freq='M'))
            if not np.isfinite(p).all():
                continue
            vol = float(p.pct_change(fill_method=None).iloc[1:].std(ddof=1)*np.sqrt(12))
            if vol <= 1e-10:
                continue
            markets[t,a] = [p.iloc[-1]/p.loc[month-4]-1,
                p.iloc[-1]/p.loc[month-12]-1, vol, frame.cashYield.iloc[t]]
            vols[t,a] = vol
    return markets, vols


def macro_features(frame, clock):
    result = np.full((len(frame), 4), np.nan)
    states = frame[['activity', 'inflationGap']].to_numpy(float)
    lookup = {m: i for i,m in enumerate(clock)}
    for t, month in enumerate(clock):
        earlier = lookup.get(month-3)
        if earlier is not None and np.isfinite(states[[t,earlier]]).all():
            result[t] = np.r_[states[t], states[t]-states[earlier]]
    return result


def matrices(markets, macro, value, price, family):
    result = []
    for a in range(5):
        parts = [markets[:,a]]
        if family != 'market':
            parts.append(macro)
        if family in ['interaction','value-price']:
            activity, inflation, dg, di = macro.T
            momentum = markets[:,a,1]
            parts.append(np.column_stack([activity*dg, inflation*di, dg*di, momentum*dg, momentum*di]))
        if family == 'value-price':
            v, p = value[:,a], price[:,a]
            parts.append(np.column_stack([v,p,v*macro[:,2],v*macro[:,3],p*macro[:,2],p*macro[:,3]]))
        result.append(np.column_stack(parts))
    return result


def training_indices(eligible, y, end, cutoff, window=0):
    ix = np.flatnonzero(eligible & np.isfinite(y).all(axis=1) & (end <= np.datetime64(cutoff)))
    return ix[-window:] if window else ix


def fit_candidates(configs, xs, eligible, y, end, cutoffs):
    predictions = np.full((len(configs), len(y), 5), np.nan)
    for ci,c in enumerate(configs):
        for t in np.flatnonzero(eligible):
            train = training_indices(eligible, y, end, cutoffs[t], c['window'])
            if len(train) < 60:
                continue
            for a in range(5):
                x = xs[c['family']][a]
                predictions[ci,t,a] = engine.ridge_predict(x[train], y[train,a], x[t], c['alpha'])[0]
        print(json.dumps({'configuration': c['id'], 'forecasts': int(np.isfinite(predictions[ci]).all(axis=1).sum())}), flush=True)
    return predictions


def rank_ic_matrix(predictions, y):
    # Average ranks for exact ties, matching Spearman. Vectorise the no-tie
    # majority; explicit ties also cover equal forecasts and synthetic tests.
    def ranks(x):
        return 1 + (x[...,None] > x[...,None,:]).sum(axis=-1) + .5*((x[...,None] == x[...,None,:]).sum(axis=-1)-1)
    a,b = ranks(predictions), ranks(y)
    a,b = a-a.mean(axis=-1,keepdims=True), b-b.mean(axis=-1,keepdims=True)
    denominator = np.sqrt((a*a).sum(axis=-1)*(b*b).sum(axis=-1))
    with np.errstate(divide='ignore',invalid='ignore'):
        result = (a*b).sum(axis=-1)/denominator
    return np.where(np.isfinite(predictions).all(axis=-1) & np.isfinite(y).all(axis=-1),result,np.nan)


def selection_indices(all_predictions, y, end, cutoff):
    valid = np.isfinite(all_predictions).all(axis=(0,2)) & np.isfinite(y).all(axis=1)
    return np.flatnonzero(valid & (end <= np.datetime64(cutoff)))[-60:]


def select_candidates(configs, predictions, y, end, cutoffs, families):
    ics = rank_ic_matrix(predictions,y)
    selected = {m: np.full_like(y,np.nan) for m in [*families,'adaptive']}
    choices = {m: [] for m in selected}
    for t in range(len(y)):
        if not np.isfinite(predictions[:,t]).all():
            continue
        history = selection_indices(predictions,y,end,cutoffs[t])
        if len(history)<24:
            continue
        quality = np.nanmean(ics[:,history],axis=1)
        for model in selected:
            allowed = [i for i,c in enumerate(configs) if model=='adaptive' or c['family']==model]
            best = max(allowed,key=lambda i: (round(float(quality[i]),12),-i))
            selected[model][t] = predictions[best,t]
            choices[model].append({'index':t,'candidate':configs[best]['id'],
                'selectionCount':len(history),'selectionFirst':int(history[0]),
                'selectionLast':int(history[-1]),'selectionRankIC':float(quality[best])})
    return selected, choices, ics


def allocation(prediction, vol, policy='tilt'):
    if not np.isfinite(prediction).all() or not np.isfinite(vol).all() or np.any(vol<=0):
        return np.zeros(5)
    if policy=='winner':
        result=np.zeros(5)
        if np.max(prediction)>0:
            result[int(np.argmax(prediction))]=1
        return result
    b=(1/vol)/np.sum(1/vol)
    ranks=pd.Series(prediction).rank().to_numpy()
    w=b*(1+.5*(ranks-3)/2)
    return w/w.sum()


def summary(predictions,y,mask,clock):
    ix=np.flatnonzero(mask)
    if not len(ix):
        return {'n':0,'first':None,'last':None,'meanRankIC':None,'topAssetExcess':None}
    return {'n':len(ix),'first':str(clock[ix[0]]),'last':str(clock[ix[-1]]),
        'meanRankIC':float(np.nanmean(rank_ic_matrix(predictions[ix],y[ix]))),
        'topAssetExcess':float(np.mean(y[ix,np.argmax(predictions[ix],axis=1)]))}


def bootstrap_ic(a,b,h):
    return bootstrap_pair(a,b,h,False)


def bootstrap_pair(a,b,h,sharpe=False,cash=None):
    # Calendar positions, including missing ranking rows, remain in the clock.
    valid=np.isfinite(a)&np.isfinite(b)
    if valid.sum()<max(24,2*h):
        return {'available':False,'n':int(valid.sum()),'reason':'Insufficient dependent-window history'}
    if sharpe:
        if not valid.all() or cash is None or not np.isfinite(cash).all():
            raise ValueError('Policy bootstrap requires a complete paired calendar')
        def stat(x,rf):
            excess=x-rf
            return np.mean(excess,axis=-1)/np.std(excess,axis=-1,ddof=1)*np.sqrt(12)
        observed=stat(a,cash)-stat(b,cash)
    else:
        observed=float(np.nanmean(a-b))
    n=len(a);block=max(12,h);reps=2500
    rng=np.random.default_rng(20261022)
    starts=rng.integers(0,n,size=(reps,int(np.ceil(n/block))))
    ix=((starts[:,:,None]+np.arange(block))%n).reshape(reps,-1)[:,:n]
    BOOTSTRAP_DRAWS[f'{n}:{block}']=ix
    if sharpe:
        draws=stat(a[ix],cash[ix])-stat(b[ix],cash[ix])
    else:
        with np.errstate(invalid='ignore'):
            draws=np.nanmean((a-b)[ix],axis=1)
    draws=draws[np.isfinite(draws)]
    # Include mathematical boundary ties despite floating arithmetic ordering.
    p=(1+np.count_nonzero(np.abs(draws-observed)>=abs(observed)-1e-12))/(len(draws)+1)
    return {'available':True,'n':int(valid.sum()),'difference':float(observed),
        'lower95':float(np.quantile(draws,.025)),'upper95':float(np.quantile(draws,.975)),
        'p':float(p),'blockMonths':block,'replications':reps}


def policy(predictions,vols,prices,clock,realised,cash,mask,kind='tilt'):
    targets=np.array([allocation(p,v,kind) for p,v in zip(predictions,vols)])
    weights=np.array([engine.risk_weights(w,prices,clock,t) for t,w in enumerate(targets)])
    return engine.evaluate_strategy(weights,realised,cash,mask,clock)


def run(cohort,h,frame,clock,prices,markets,vols,macro,value,price,cash,realised):
    families=FAMILIES if cohort=='value' else FAMILIES[:3]
    eligible=np.isfinite(markets).all(axis=(1,2)) & np.isfinite(macro).all(axis=1)
    if cohort=='value':
        eligible &= np.isfinite(value).all(axis=1)&np.isfinite(price).all(axis=1)
    y,end=engine.labels(prices,clock,cash,h)
    xs={f:matrices(markets,macro,value,price,f) for f in families}
    configs=[configuration(f,a,w) for f in families for a,w in SETTINGS]
    p=fit_candidates(configs,xs,eligible,y,end,frame.cutoff.tolist())
    selected,choices,ics=select_candidates(configs,p,y,end,frame.cutoff.tolist(),families)
    ready=np.isfinite(selected['adaptive']).all(axis=1)
    selected['mean']=np.full_like(y,np.nan)
    for t in np.flatnonzero(ready):
        train=training_indices(eligible,y,end,frame.cutoff.iloc[t])
        selected['mean'][t]=y[train].mean(axis=0)
    common=ready&np.isfinite(y).all(axis=1)
    market=np.isfinite(realised).all(axis=1)&np.isfinite(cash)
    starts=np.flatnonzero(ready&market);mask=market.copy()
    if len(starts):mask[:starts[0]]=False
    else:mask[:]=False
    policies={m:policy(pred,vols,prices,clock,realised,cash,mask) for m,pred in selected.items()}
    winner={m:policy(pred,vols,prices,clock,realised,cash,mask,'winner') for m,pred in selected.items()}
    targets={'Inverse volatility':np.divide(1,vols),'SPY':np.tile([1.,0,0,0,0],(len(frame),1)),
        '60/40':np.tile([.6,.4,0,0,0],(len(frame),1)),'Equal five':np.full((len(frame),5),.2)}
    for name,weights in targets.items():
        weights=weights/weights.sum(axis=1,keepdims=True)
        weights[~np.isfinite(weights).all(axis=1)]=0
        risk=np.array([engine.risk_weights(w,prices,clock,t) for t,w in enumerate(weights)])
        policies[name]=engine.evaluate_strategy(risk,realised,cash,mask,clock)
    attempts=[]
    for i,c in enumerate(configs):
        raw=np.isfinite(p[i]).all(axis=1)&np.isfinite(y).all(axis=1)
        attempts.append({**c,'ranking':summary(p[i],y,common,clock),
            'fullCandidateHistory':summary(p[i],y,raw,clock),
            'policy':policy(p[i],vols,prices,clock,realised,cash,mask),
            'selectedMonths':{m:sum(x['candidate']==c['id'] for x in rows) for m,rows in choices.items()}})
        # All candidate summaries stay in the public search ledger; individual
        # candidate weight paths remain private to keep the artifact manageable.
        attempts[-1]['policy'].pop('rows',None)
    forecasts=[]
    choice_lookup={m:{r['index']:r for r in rows} for m,rows in choices.items()}
    for t in np.flatnonzero(ready):
        methods={}
        for m in selected:
            choice=choice_lookup.get(m,{}).get(t)
            c=next((c for c in configs if choice and c['id']==choice['candidate']),None)
            train=training_indices(eligible,y,end,frame.cutoff.iloc[t],c['window'] if c else 0)
            methods[m]={'candidate':choice['candidate'] if choice else 'mean',
                'training':len(train),'lastTrainingMaturity':str(pd.Timestamp(end[train[-1]])).split()[0],
                'selectionCount':choice['selectionCount'] if choice else 0,
                'selectionLastMaturity':str(pd.Timestamp(end[choice['selectionLast']])).split()[0] if choice else None,
                'selectionRankIC':choice['selectionRankIC'] if choice else None}
        forecasts.append({'month':str(clock[t]),'cutoff':frame.cutoff.iloc[t],'tradeDate':frame.tradeDate.iloc[t],
            'common':bool(common[t]),'predictions':{m:v[t].tolist() for m,v in selected.items()},
            'outcomes':y[t].tolist(),'methods':methods})
    folds={}
    for label,condition in {'Through 2019':clock.year<=2019,'2020–2022':(clock.year>=2020)&(clock.year<=2022),
        '2023 onward':clock.year>=2023}.items():
        fold=common&condition
        if fold.any():folds[label]={m:summary(v,y,fold,clock) for m,v in selected.items()}
    comparisons=[]
    ix=np.flatnonzero(common)
    for model in ['adaptive','interaction']:
        if not len(ix):continue
        lo,hi=ix[0],ix[-1]+1
        a=np.where(common,rank_ic_matrix(selected[model],y),np.nan)[lo:hi]
        b=np.where(common,rank_ic_matrix(selected['market'],y),np.nan)[lo:hi]
        pa,pb=policies[model],policies['market']
        comparisons.append({'model':model,'against':'market','ranking':bootstrap_ic(a,b,h),
            'policy':bootstrap_pair(np.array([r['return'] for r in pa['rows']]),
                np.array([r['return'] for r in pb['rows']]),12,True,np.array([r['cash'] for r in pa['rows']])),
            'economicGates':{'higherNetCAGR':pa['cagr']>pb['cagr'],
                'comparableRisk':pa['volatility']<=1.1*pb['volatility'],
                'drawdownNoWorse':pa['maxDrawdown']>=pb['maxDrawdown']},
            'foldGains':{k:v[model]['meanRankIC']-v['market']['meanRankIC'] for k,v in folds.items()}})
    result={'horizon':h,'cohort':cohort,'configurations':len(configs),'models':{m:summary(v,y,common,clock) for m,v in selected.items()},
        'coverage':{'decisions':len(frame),'completeInputs':int(eligible.sum()),'commonStarts':int(common.sum()),
            'holdingMonths':int(mask.sum()),'cashFallbackMonths':int((mask&~ready).sum())},
        'attempts':attempts,'strategies':policies,'winnerSensitivity':winner,'forecastRows':forecasts,
        'folds':folds,'comparisons':comparisons,
        'selectionCounts':{m:dict(pd.Series([x['candidate'] for x in rows]).value_counts()) for m,rows in choices.items()}}
    private={'configurations':configs,'eligible':eligible,'predictions':p,'targets':y,'end':end.astype(str).tolist(),
        'choices':choices,'selected':selected,'marketMask':mask}
    return result,private


def build():
    WORK.mkdir(exist_ok=True,parents=True)
    source=json.loads((BASE/'source-manifest.json').read_text())
    v3=json.loads((ROOT/'data/asset-scores.json').read_text())
    if v3['sourceStatus']!='complete' or v3['audit']['checkedInputSha256']!=engine.sha(ROOT/'work/research-v3/features.json'):
        raise ValueError('Verified complete v3 inputs required')
    raw=json.loads((BASE/'features.json').read_text());frame=pd.DataFrame(raw['rows'])
    scores=json.loads((ROOT/'work/research-v3/features.json').read_text())
    value_manifest=json.loads((ROOT/'work/research-v3/source-manifest.json').read_text())
    if value_manifest['baseFeatureSha256']!=engine.sha(BASE/'features.json'):
        raise ValueError('Macro inputs differ from verified value-source calendar')
    if [r['cutoff'] for r in scores['rows']]!=frame.cutoff.tolist():raise ValueError('Mismatched source calendars')
    clock=pd.PeriodIndex(frame.tradeDate,freq='M')
    if clock.duplicated().any():raise ValueError('Duplicate decision months')
    prices={a:engine.load_prices(BASE/f'prices/{a}.csv',source['asOf']) for a in ASSETS}
    cash=np.full(len(frame),np.nan)
    for t in range(len(frame)-1):
        if clock[t+1]==clock[t]+1 and pd.notna(frame.cashYield.iloc[t]):
            days=(pd.Timestamp(frame.tradeDate.iloc[t+1])-pd.Timestamp(frame.tradeDate.iloc[t])).days
            cash[t]=(1+frame.cashYield.iloc[t]/100)**(days/365)-1
    realised=np.column_stack([prices[a].reindex(clock+1).to_numpy()/prices[a].reindex(clock).to_numpy()-1 for a in ASSETS])
    for t in range(len(frame)):
        if t+1==len(frame) or clock[t+1]!=clock[t]+1:realised[t]=np.nan
    markets,vols=market_features(prices,clock,frame);macro=macro_features(frame,clock)
    value=np.array([[r['assets'][a]['value']['z'] for a in ASSETS] for r in scores['rows']],float)
    price=np.array([[r['assets'][a]['price']['z'] for a in ASSETS] for r in scores['rows']],float)
    inputs={p:engine.sha(ROOT/p) for p in ['work/research-v2/features.json','work/research-v3/features.json',
        'work/research-v2/source-manifest.json','work/research-v3/source-manifest.json',
        *[f'work/research-v2/prices/{a}.csv' for a in ASSETS]]}
    input_hash=hashlib.sha256(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    output={'version':'macro-transition-lab-4','asOf':source['asOf'],'status':'exploratory-retrospective',
        'protocolSha256':engine.sha(HERE/'protocol.md'),'inputSha256':input_hash,'sourceHashes':inputs,
        'assets':ASSETS,'modelLabels':LABELS,'primaryHorizon':12,'attemptCount':84,'horizons':{},
        'limitations':['All historical periods were already exposed to earlier research; no untouched holdout.',
            'Selection uses only mature earlier out-of-sample outcomes, but research design itself is retrospective.',
            'Monthly forecast starts overlap. Asset universe is small; proxy quality differs by asset.',
            'Macro impulses are changes in published state estimates, not market-expectation surprises.',
            'Value/price cohort has a shorter history and is evaluated separately.',
            'No confirmed predictive edge; promising results require future prospective validation.']}
    private={'markets':markets,'vols':vols,'macro':macro,'value':value,'price':price,'cash':cash,'realised':realised,'studies':{}}
    for h in [12,3]:
        output['horizons'][str(h)]={};private['studies'][str(h)]={}
        for cohort in ['main','value']:
            public,internal=run(cohort,h,frame,clock,prices,markets,vols,macro,value,price,cash,realised)
            output['horizons'][str(h)][cohort]=public;private['studies'][str(h)][cohort]=internal
            print(json.dumps({'horizon':h,'cohort':cohort,'models':public['models'],'coverage':public['coverage']}),flush=True)
    for metric in ['ranking','policy']:
        tests=[c[metric] for study in output['horizons']['12'].values() for c in study['comparisons']]
        engine.holm(tests)
    for h,studies in output['horizons'].items():
        for study in studies.values():
            for c in study['comparisons']:
                economic=all(c['economicGates'].values())
                statistically_supported=all(c[m].get('available') and c[m]['lower95']>0 and c[m].get('holmP',1)<.05 for m in ['ranking','policy'])
                stable=all(v>0 for v in c['foldGains'].values())
                c['status']='Stronger retrospective candidate' if h=='12' and economic and statistically_supported and stable else 'Exploratory economic candidate' if economic else 'No economic improvement on all gates'
                c['confirmedEdge']=False
    private['bootstrapDraws']=BOOTSTRAP_DRAWS
    (WORK/'private-audit.json').write_text(json.dumps(safe(private),separators=(',',':'),allow_nan=False))
    (WORK/'research-candidate.json').write_text(json.dumps(safe(output),separators=(',',':'),allow_nan=False))
    print(json.dumps({'attempts':84,'candidate':str(WORK/'research-candidate.json'),'status':'awaiting-independent-verification'}),flush=True)
    return output


if __name__=='__main__':build()
