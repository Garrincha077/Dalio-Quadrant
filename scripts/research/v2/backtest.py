"""Causal expanding state/momentum comparison. Raw sources remain in ignored work/."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / "work/research-v2"
sys.path.insert(0, str(HERE.parent))
from backtest import ridge_predict, net_returns, metrics
from state_forward import classify, summarise

ASSETS = ["SPY", "IEF", "GLD", "TIP", "DBC"]
BLOCKS = {"state": ["activity", "inflationGap"], "momentum": ["growth", "inflation"],
          "combined": ["activity", "inflationGap", "growth", "inflation"]}
MODELS = ["state", "momentum", "combined", "unconditional", "state-trend"]
HORIZONS = [3, 12, 36]
MIN_TRAIN = 60


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe(value):
    if isinstance(value, dict): return {k: safe(v) for k, v in value.items()}
    if isinstance(value, (tuple, list, np.ndarray)): return [safe(v) for v in value]
    if isinstance(value, (np.integer,)): return int(value)
    if isinstance(value, (float, np.floating)): return float(value) if np.isfinite(value) else None
    return value


def load_prices(path, as_of):
    frame = pd.read_csv(path)
    months = pd.PeriodIndex(frame.timestamp, freq="M")
    if months.duplicated().any(): raise ValueError("Duplicate source price month")
    frame.index = months
    frame = frame[frame.index < pd.Period(as_of, freq="M")].sort_index()
    values = pd.to_numeric(frame["adjusted close"], errors="raise")
    if not np.isfinite(values).all() or (values <= 0).any():
        raise ValueError("Non-positive or invalid adjusted price")
    return values


def labels(prices, clock, cash_monthly, horizon):
    out = np.full((len(clock), len(ASSETS)), np.nan)
    ends = np.full(len(clock), np.datetime64("NaT"), dtype="datetime64[ns]")
    for t, month in enumerate(clock):
        if t + horizon >= len(clock) or clock[t+horizon] != month + horizon:
            continue
        required = pd.period_range(month, month+horizon, freq="M")
        carry = cash_monthly[t:t+horizon]
        if len(carry) != horizon or not np.isfinite(carry).all(): continue
        for a, symbol in enumerate(ASSETS):
            p = prices[symbol]
            if required.isin(p.index).all():
                out[t, a] = p.loc[month+horizon] / p.loc[month] - np.prod(1+carry)
        ends[t] = (month+horizon).to_timestamp(how="end").normalize().to_datetime64()
    return out, ends


def pool_forecast(frame, train, y, t):
    if frame.stateTrend.iloc[t] is None or pd.isna(frame.stateTrend.iloc[t]): return None
    a, gap = frame.loc[t, ["activity", "inflationGap"]]
    above, high = np.clip((a+.1)/.2, 0, 1), np.clip((gap+.2)/.4, 0, 1)
    shares = [above*high, above*(1-high), (1-above)*high, (1-above)*(1-high)]
    codes = [classify(frame.activity.iloc[k], frame.inflationGap.iloc[k]+2) for k in train]
    prior = y[train].mean(axis=0)
    result = np.zeros(len(ASSETS))
    for q, share in zip(["above-above", "above-below", "below-above", "below-below"], shares):
        parent = train[np.array(codes) == q]
        joint = parent[(frame.stateTrend.iloc[parent] == frame.stateTrend.iloc[t]).to_numpy()]
        alpha, beta = len(parent)/(len(parent)+24), len(joint)/(len(joint)+24)
        broad = alpha*y[parent].mean(axis=0)+(1-alpha)*prior if len(parent) else prior
        result += share*(beta*y[joint].mean(axis=0)+(1-beta)*broad if len(joint) else broad)
    return result


def forecasts(frame, y, target_end, common=True):
    x = frame[BLOCKS["combined"]].to_numpy(float)
    valid_y = np.isfinite(y).all(axis=1)
    predictions = {m: np.full_like(y, np.nan) for m in MODELS}
    counts = {m: np.zeros(len(frame), dtype=int) for m in MODELS}
    for t in range(len(frame)):
        mature = valid_y & (target_end <= np.datetime64(frame.cutoff.iloc[t]))
        for model in MODELS:
            cols = BLOCKS.get(model, BLOCKS["state"] if model == "state-trend" else [])
            features = frame[cols].to_numpy(float)
            eligible = np.isfinite(x).all(axis=1) if common else np.isfinite(features).all(axis=1)
            if not np.isfinite(features[t]).all() or (common and not eligible[t]): continue
            train = np.flatnonzero(mature & eligible)
            if model == "state-trend":
                train = train[frame.stateTrend.iloc[train].notna().to_numpy()]
            counts[model][t] = len(train)
            if len(train) < MIN_TRAIN: continue
            if model == "unconditional": pred = y[train].mean(axis=0)
            elif model == "state-trend": pred = pool_forecast(frame, train, y, t)
            else: pred = ridge_predict(features[train], y[train], features[t], 100)[0]
            if pred is not None: predictions[model][t] = pred
    return predictions, counts


def rank_ic(pred, realised):
    if not np.isfinite(pred).all() or not np.isfinite(realised).all(): return np.nan
    a, b = pd.Series(pred).rank().to_numpy(), pd.Series(realised).rank().to_numpy()
    if np.std(a) == 0 or np.std(b) == 0: return np.nan
    return float(np.corrcoef(a, b)[0, 1])


def bootstrap_difference(a, b, horizon, reps=2500):
    diff = np.asarray(a)-np.asarray(b)
    n = len(diff)
    valid = np.isfinite(diff)
    if valid.sum() < max(24, 2*horizon):
        return {"available": False, "reason": "Insufficient calendar history for dependent-window uncertainty", "n": int(valid.sum())}
    rng = np.random.default_rng(20261021)
    block = max(12, horizon)
    starts = rng.integers(0, n, size=(reps, int(np.ceil(n/block))))
    idx = ((starts[:,:,None]+np.arange(block)) % n).reshape(reps,-1)[:,:n]
    samples = diff[idx]
    count = np.isfinite(samples).sum(axis=1)
    means = np.divide(np.nansum(samples, axis=1), count, out=np.full(reps,np.nan), where=count>0)
    means = means[np.isfinite(means)]
    observed = float(np.nanmean(diff))
    p = float((1+np.count_nonzero(np.abs(means-observed) >= abs(observed)))/(len(means)+1))
    return {"available": True, "n": int(valid.sum()), "difference": observed,
            "lower95": float(np.quantile(means,.025)), "upper95": float(np.quantile(means,.975)),
            "p": p, "blockMonths": block, "replications": reps}


def holm(tests):
    eligible = sorted([(i,t["p"]) for i,t in enumerate(tests) if t.get("available")], key=lambda x:x[1])
    last = 0.
    # The family remains three declared hypotheses even if one is unavailable.
    for rank,(i,p) in enumerate(eligible):
        last = min(1., max(last,(len(tests)-rank)*p))
        tests[i]["holmP"] = last
    return tests


def risk_weights(target, prices, clock, t):
    result = np.r_[1., np.zeros(len(ASSETS))]
    if not np.any(target): return result
    months = pd.period_range(clock[t]-36, clock[t]-1, freq="M")
    histories = []
    for a,symbol in enumerate(ASSETS):
        if target[a] == 0: histories.append(np.zeros(36)); continue
        p = prices[symbol].reindex(pd.period_range(clock[t]-37,clock[t]-1,freq="M"))
        r = p.pct_change(fill_method=None).iloc[1:]
        if len(r) != 36 or not np.isfinite(r).all(): return result
        histories.append(r.to_numpy())
    combined = np.array(histories).T @ target
    vol = np.std(combined,ddof=1)*np.sqrt(12)
    if not np.isfinite(vol) or vol <= 1e-10: return result
    risky = target*min(1.,.10/vol)
    return np.r_[1-risky.sum(),risky]


def evaluate_strategy(weights, realised, cash, mask, months):
    idx = np.flatnonzero(mask)
    if not len(idx): return None
    if not np.isfinite(realised[idx]).all(): raise ValueError("Missing market return in strategy sample")
    # Require a complete calendar: no silent deletion of a losing/missing month.
    if any(months[idx[k]] != months[idx[k-1]]+1 for k in range(1,len(idx))):
        return {"available": False, "reason": "Market data gap; continuous strategy evaluation withheld"}
    all_returns = np.column_stack([cash,realised])
    net,cost,turn = net_returns(weights[idx],all_returns[idx],10)
    stress,_,_ = net_returns(weights[idx],all_returns[idx],25)
    m = metrics(net,cash[idx],turn)
    m.update({"available":True,"first":str(months[idx[0]]+1),"last":str(months[idx[-1]]+1),
              "cagrAt25bps":metrics(stress,cash[idx])["cagr"],"cashExposure":float(weights[idx,0].mean()),
              "costTotal":float(cost.sum()),"rows":[{"month":str(months[i]+1),"return":float(net[k]),
              "cash":float(cash[i]),"turnover":float(turn[k]),"cost":float(cost[k]),
              "weights":weights[i].tolist()} for k,i in enumerate(idx)]})
    return m


def build():
    source = json.loads((WORK/"source-manifest.json").read_text())
    feature = json.loads((WORK/"features.json").read_text())
    frame = pd.DataFrame(feature["rows"])
    for _,r in frame.iterrows():
        if any(d and d>r.cutoff for d in r.inputDates.values()): raise ValueError("Future feature observation")
    clock = pd.PeriodIndex(frame.tradeDate,freq="M")
    if clock.duplicated().any(): raise ValueError("Duplicate decisions")
    prices = {a:load_prices(WORK/f"prices/{a}.csv",source["asOf"]) for a in ASSETS}
    cash = np.full(len(frame),np.nan)
    for t in range(len(frame)-1):
        if clock[t+1] == clock[t]+1 and pd.notna(frame.cashYield.iloc[t]):
            days = (pd.Timestamp(frame.tradeDate.iloc[t+1])-pd.Timestamp(frame.tradeDate.iloc[t])).days
            cash[t] = (1+frame.cashYield.iloc[t]/100)**(days/365)-1
    realised = np.column_stack([prices[a].reindex(clock+1).to_numpy()/prices[a].reindex(clock).to_numpy()-1 for a in ASSETS])
    for t,month in enumerate(clock):
        if t+1 == len(clock) or clock[t+1] != month+1: realised[t] = np.nan
    price_coverage = {a:{"first":str(p.index.min()),"last":str(p.index.max()),"n":len(p),
       "missing":len(pd.period_range(p.index.min(),p.index.max(),freq="M").difference(p.index)),
       "source":"Alpha Vantage adjusted monthly", "sha256":sha(WORK/f"prices/{a}.csv")} for a,p in prices.items()}
    output = {"version":"state-momentum-research-2","asOf":source["asOf"],"protocolSha256":sha(HERE/"protocol.md"),
      "status":"retrospective-walk-forward","primaryHorizon":12,"horizons":{},"assets":ASSETS,
      "priceCoverage":price_coverage,"sourceFailures":source["failures"],
      "rules":{"minimumTraining":60,"ridgeLambda":100,"rebalanceMonths":1,"targetVolatility":.10,
               "riskHistoryMonths":36,"costBps":10,"stressCostBps":25,"leverage":False},
      "limitations":["Historical v2 results are retrospective; 2021–25 was already reviewed.",
          "Reconstructed CFNAI before March 2001 is descriptive history, not a published historical signal.",
          "Monthly forward labels overlap; row counts are not independent trials.",
          "Forecast horizon differs from the monthly trading rebalance.",
          "Volatility targeting caps exposure without leverage; realised risks can still differ.",
          "ETF adjusted prices are total-return proxies; taxes, financing and intramonth execution are omitted.",
          "No confirmed predictive edge status is emitted. Source histories and source coverage can change."]}
    for h in HORIZONS:
        y,end = labels(prices,clock,cash,h)
        predictions,counts = forecasts(frame,y,end,True)
        maximum,maxcounts = forecasts(frame,y,end,False)
        common = np.isfinite(y).all(axis=1)
        # The three primary models and unconditional comparator have identical eligibility.
        for model in ["state","momentum","combined","unconditional"]:
            common &= np.isfinite(predictions[model]).all(axis=1)
        ic = {m:np.array([rank_ic(p,r) for p,r in zip(predictions[m],y)]) for m in MODELS}
        indices = np.flatnonzero(common)
        model_stats = {}
        for m in MODELS:
            eligible = common & np.isfinite(predictions[m]).all(axis=1)
            ix = np.flatnonzero(eligible)
            top = np.argmax(np.nan_to_num(predictions[m],nan=-np.inf),axis=1)
            own = np.isfinite(maximum[m]).all(axis=1)&np.isfinite(y).all(axis=1)
            own_ix = np.flatnonzero(own)
            model_stats[m] = {"n":len(ix),"first":str(clock[ix[0]]) if len(ix) else None,
                "last":str(clock[ix[-1]]) if len(ix) else None,"meanRankIC":float(np.nanmean(ic[m][ix])) if len(ix) else None,
                "topAssetExcess":float(np.mean(y[ix,top[ix]])) if len(ix) else None,
                "maximumHistory":{"n":int(own.sum()),"first":str(clock[own_ix[0]]) if len(own_ix) else None,
                    "last":str(clock[own_ix[-1]]) if len(own_ix) else None,
                    "meanRankIC":float(np.nanmean([rank_ic(maximum[m][i],y[i]) for i in own_ix])) if len(own_ix) else None}}
        tests=[]
        if len(indices):
            lo,hi=indices[0],indices[-1]+1
            for m in ["state","momentum","unconditional"]:
                a,b=ic["combined"][lo:hi].copy(),ic[m][lo:hi].copy()
                a[~common[lo:hi]]=np.nan;b[~common[lo:hi]]=np.nan
                tests.append({"against":m,**bootstrap_difference(a,b,h)})
        if h==12: tests=holm(tests)
        else:
            for test in tests: test["exploratory"]=True
        targets={m:np.zeros((len(frame),len(ASSETS))) for m in MODELS}
        for m in MODELS:
            for t,p in enumerate(predictions[m]):
                if np.isfinite(p).all() and p.max()>0: targets[m][t,np.argmax(p)]=1
        for name,target in {"SPY": [1,0,0,0,0],"60/40":[.6,.4,0,0,0],"Equal five":[.2]*5}.items():
            targets[name]=np.tile(target,(len(frame),1))
        targets["SPY trend"]=targets["SPY"].copy()
        for t,month in enumerate(clock):
            p=prices["SPY"].reindex(pd.period_range(month-13,month-1,freq="M"))
            if not np.isfinite(p).all() or p.iloc[-1]<=p.iloc[0]: targets["SPY trend"][t]=0
        weights={name:np.array([risk_weights(target,prices,clock,t) for t,target in enumerate(ts)]) for name,ts in targets.items()}
        market=np.isfinite(realised).all(axis=1)&np.isfinite(cash)
        forecast_available=np.isfinite(predictions["combined"]).all(axis=1)
        starts=np.flatnonzero(forecast_available&market)
        strategy_mask=market.copy()
        if len(starts): strategy_mask[:starts[0]]=False
        else: strategy_mask[:]=False
        # Missing forecasts AFTER inception stay in the policy as cash.
        strategies={name:evaluate_strategy(w,realised,cash,strategy_mask,clock) for name,w in weights.items()}
        for name in ["SPY","60/40","Equal five"]:
            ts=targets[name];w=np.column_stack([1-ts.sum(axis=1),ts])
            strategies[name+" full exposure"]=evaluate_strategy(w,realised,cash,strategy_mask,clock)
        forecast_rows=[]
        for t in range(len(frame)):
            if any(np.isfinite(predictions[m][t]).all() for m in MODELS):
                forecast_rows.append({"month":str(clock[t]),"cutoff":frame.cutoff.iloc[t],"tradeDate":frame.tradeDate.iloc[t],
                    "stateMonth":frame.stateMonth.iloc[t],"training":{m:int(counts[m][t]) for m in MODELS},
                    "predictions":{m:predictions[m][t].tolist() for m in MODELS},"outcomes":y[t].tolist(),
                    "rankIC":{m:float(ic[m][t]) for m in MODELS},"common":bool(common[t])})
        periods={}
        for name,mask in {"full":common,"last20":common&(clock>=clock[-1]-239),
            **{str(d)+"s":common&(clock.year>=d)&(clock.year<d+10) for d in range((clock[0].year//10)*10,clock[-1].year+1,10)}}.items():
            ix=np.flatnonzero(mask)
            if len(ix): periods[name]={"n":len(ix),"first":str(clock[ix[0]]),"last":str(clock[ix[-1]]),
                 "rankIC":{m:float(np.nanmean(ic[m][ix])) for m in MODELS}}
        output["horizons"][str(h)]={"models":model_stats,"comparisons":tests,"strategies":strategies,
            "periods":periods,"forecastRows":forecast_rows,"coverage":{
              "decisionMonths":len(frame),"completeOutcomes":int(np.isfinite(y).all(axis=1).sum()),
              "missingState":int(frame[BLOCKS['state']].isna().any(axis=1).sum()),
              "missingMomentum":int(frame[BLOCKS['momentum']].isna().any(axis=1).sum()),
              "commonEvaluationMonths":int(common.sum()),"strategyCalendarMonths":int(strategy_mask.sum()),
              "cashFallbackMonths":int((strategy_mask&~forecast_available).sum())}}
    output["sources"]={"fred":source["sources"],"chicago":source["chicago"],
                       "featureSha256":sha(WORK/"features.json")}
    path=ROOT/"data/research-v2.json"
    path.write_text(json.dumps(safe(output),separators=(",",":"),allow_nan=False))
    build_history(source,prices)
    print(json.dumps({"status":output["status"],"horizons":{h:{"models":v["models"],"coverage":v["coverage"]} for h,v in output["horizons"].items()}},default=safe))
    return output


def build_history(source,prices):
    revised=json.loads((WORK/"revised-history.json").read_text())
    frame=pd.DataFrame(revised["points"])
    frame.index=pd.PeriodIndex(frame.month,freq="M")
    frame["inflation"]=frame.inflationGap+2
    frame["quadrant"]=[classify(a,b) for a,b in zip(frame.activity,frame.inflation)]
    # Explicit separate broad-US-equity proxy, not a backfilled SPY price history.
    proxy={"available":False,"reason":"Long-run monthly equity source unavailable"}
    file=WORK/"french.zip"
    if file.exists() and source.get('equityContext'):
        z=zipfile.ZipFile(file);text=z.read(z.namelist()[0]).decode("utf-8-sig")
        lines=[line for line in text.splitlines() if len(line.split(',')[0].strip())==6 and line.split(',')[0].strip().isdigit()]
        f=pd.read_csv(io.StringIO("month,mkt,SMB,HML,RF\n"+"\n".join(lines)))
        f.index=pd.PeriodIndex(pd.to_datetime(f.month.astype(str),format="%Y%m"),freq="M")
        returns=(f.mkt+f.RF)/100
        returns=returns[(returns.index<pd.Period(source['asOf'],freq='M'))&np.isfinite(returns)]
        cohorts={}
        for h in HORIZONS:
            values=[]
            for month in frame.index:
                r=returns.reindex(pd.period_range(month+1,month+h,freq="M"))
                values.append(float(np.prod(1+r)-1) if len(r)==h and np.isfinite(r).all() else np.nan)
            sample=frame.copy();sample["return"]=values
            cohorts[str(h)]=summarise(sample,h)
        proxy={"available":True,"name":"Broad US equity research proxy (Fama/French market + RF)",
          "basis":"Revised-data descriptive association; not SPY and not a point-in-time strategy",
          "source":"https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html",
          "sha256":sha(file),"frequency":"monthly","first":str(returns.index.min()),"last":str(returns.index.max()),
          "n":len(returns),"monthlyReturns":[{"month":str(m),"return":float(v)} for m,v in returns.items()],"cohorts":cohorts}
    annual=[]
    jst=WORK/"jst-source.xlsx"
    if jst.exists() and source.get('context'):
        f=pd.read_excel(jst);us=f[f.iso=='USA']
        annual=[{"year":int(r.year),"equity":r.eq_tr,"bonds":r.bond_tr,"bills":r.bill_rate} for _,r in us.iterrows()]
    # Monthly descriptive ETF outcomes over maximal per-asset and common cohorts.
    cohorts={}
    for h in HORIZONS:
        matrix={}
        for symbol,p in prices.items():
            vals=[]
            for month in frame.index:
                r=p.reindex(pd.period_range(month,month+h,freq='M'))
                vals.append(float(r.iloc[-1]/r.iloc[0]-1) if np.isfinite(r).all() else np.nan)
            matrix[symbol]=np.array(vals)
        common=np.isfinite(np.column_stack(list(matrix.values()))).all(axis=1)
        cohorts[str(h)]={}
        for mode in ['common','asset']:
            cohorts[str(h)][mode]={}
            for symbol in ASSETS:
                sample=frame.copy();sample['return']=matrix[symbol]
                if mode=='common': sample.loc[~common,'return']=np.nan
                cohorts[str(h)][mode][symbol]=summarise(sample,h)
    history={"version":"research-history-2","asOf":source['asOf'],"basis":revised['basis'],
      "points":revised['points'],"equityProxy":proxy,"annualContext":{
          "source":"https://www.macrohistory.net/database/","license":"CC BY-NC-SA 4.0",
          "attribution":"Jordà, Schularick & Taylor (2017); Jordà, Knoll, Kuvshinov, Schularick & Taylor (2019)",
          "basis":"US annual research context; native annual frequency; excluded from monthly predictive models",
          "metadata":source.get('context'),"rows":annual},"cohorts":cohorts}
    (ROOT/"data/research-history.json").write_text(json.dumps(safe(history),separators=(',',':'),allow_nan=False))


if __name__ == '__main__':
    build()
