"""Predeclared monthly research; raw licensed price data stays in ignored work/.

Decision features precede the traded close by at least one calendar day. Training
labels must mature by that cutoff. Development labels stop Nov 2020; Dec 2020 is
embargoed before the untouched Jan 2021-Dec 2025 return holdout. No random splits.
"""

from pathlib import Path
import json, hashlib, math
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work/research"
ASSETS = ["SPY", "IEF", "GLD", "TIP", "DBC"]
NAMES = {
    "SPY": "S&P 500 (SPY)",
    "IEF": "7–10Y Treasuries (IEF)",
    "GLD": "Gold (GLD)",
    "TIP": "Inflation-linked bonds (TIP)",
    "DBC": "Broad commodity futures (DBC)",
    "CASH": "T-bill yield proxy",
}
MACRO = ["core_g", "core_i", "gdp_yoy", "pce_yoy", "curve", "policy_change3", "nfci"]
MARKET = ["mom3", "mom12", "vol3", "ma200"]
BLOCKS = {"macro": MACRO, "market": MARKET, "combined": MACRO + MARKET}
ALPHAS = [1.0, 10.0, 100.0]
DEV_END = pd.Timestamp("2020-11-30")
TEST_START = pd.Timestamp("2021-01-01")
TEST_END = pd.Timestamp("2025-12-31")
MIN_TRAIN = 60


def ridge_predict(x, y, test, alpha):
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    test = np.atleast_2d(np.asarray(test, float))
    med = np.array(
        [np.median(c[np.isfinite(c)]) if np.isfinite(c).any() else 0.0 for c in x.T]
    )
    x = np.where(np.isfinite(x), x, med)
    test = np.where(np.isfinite(test), test, med)
    lo, hi = np.quantile(x, [0.01, 0.99], axis=0)
    x = np.clip(x, lo, hi)
    test = np.clip(test, lo, hi)
    mean = x.mean(axis=0)
    std = x.std(axis=0)
    std = np.where(std > 1e-10, std, 1.0)
    x = (x - mean) / std
    test = (test - mean) / std
    centre = y.mean(axis=0)
    beta = np.linalg.solve(x.T @ x + alpha * np.eye(x.shape[1]), x.T @ (y - centre))
    return test @ beta + centre


def source_frames():
    feature = json.loads((WORK / "features.json").read_text(encoding="utf-8-sig"))
    f = pd.DataFrame(feature["rows"])
    if len(f) != 285 or f.tradeDate.iloc[-1][:7] != "2026-09":
        raise ValueError(
            "This frozen research version requires the declared 2003–Sep 2026 feature sample"
        )
    if any(
        date and date > row["cutoff"]
        for row in feature["rows"]
        for date in row["inputDates"].values()
    ):
        raise ValueError("Future macro reference date")
    f["tradeDate"] = pd.to_datetime(f.tradeDate)
    f["cutoff"] = pd.to_datetime(f.cutoff)
    for d in feature["definitions"]:
        f[d["id"] + "_delta"] = f.deltas.map(lambda v: v[d["id"]])
    prices = {}
    for asset in ASSETS:
        p = pd.read_csv(WORK / f"prices/{asset}.csv")
        p["timestamp"] = pd.to_datetime(p.timestamp)
        if (
            p.timestamp.dt.to_period("M").duplicated().any()
            or not (p["adjusted close"] > 0).all()
        ):
            raise ValueError(f"{asset}: duplicate months or invalid adjusted prices")
        p = p[p.timestamp.dt.to_period("M") < pd.Period("2026-10")].sort_values(
            "timestamp"
        )
        prices[asset] = p.set_index(p.timestamp.dt.to_period("M"))["adjusted close"]
    p = pd.DataFrame(prices).sort_index()
    f.index = f.tradeDate.dt.to_period("M")
    f["target_end"] = f.tradeDate.shift(-1)
    for asset in ASSETS:
        f["ret_" + asset] = (p[asset].shift(-1) / p[asset] - 1).reindex(f.index)
    days = (f.target_end - f.tradeDate).dt.days
    f["ret_CASH"] = (1 + pd.to_numeric(f.cash_yield) / 100) ** (days / 365) - 1
    yahoo = json.loads((WORK / "prices/SPY-yahoo-daily.json").read_text())["chart"][
        "result"
    ][0]
    if yahoo["meta"]["dataGranularity"] != "1d":
        raise ValueError("Daily market features require verified daily granularity")
    daily = (
        pd.Series(
            yahoo["indicators"]["adjclose"][0]["adjclose"],
            index=pd.to_datetime(yahoo["timestamp"], unit="s", utc=True)
            .tz_convert("America/New_York")
            .tz_localize(None)
            .normalize(),
        )
        .dropna()
        .sort_index()
    )
    market = []
    for cutoff in f.cutoff:
        h = daily[daily.index <= cutoff]

        def momentum(months):
            older = h[h.index <= cutoff - pd.DateOffset(months=months)]
            return h.iloc[-1] / older.iloc[-1] - 1 if len(h) and len(older) else np.nan

        market.append(
            {
                "mom3": momentum(3),
                "mom12": momentum(12),
                "vol3": h.pct_change().tail(63).std() * np.sqrt(252),
                "ma200": (
                    h.iloc[-1] / h.tail(200).mean() - 1 if len(h) >= 200 else np.nan
                ),
                "market_date_used": h.index[-1],
            }
        )
    for col in market[0]:
        f[col] = [row[col] for row in market]
    if not (pd.to_datetime(f.market_date_used) <= f.cutoff).all():
        raise ValueError("Future daily market data")
    # Independent provider reconciliation of overlapping monthly total returns.
    month_daily = daily.groupby(daily.index.to_period("M")).last()
    av = prices["SPY"].pct_change()
    yh = month_daily.pct_change()
    aligned = pd.concat([av.rename("av"), yh.rename("yh")], axis=1).dropna()
    aligned = aligned[aligned.index <= pd.Period("2026-09")]
    mismatch = (aligned.av - aligned.yh).abs()
    quality = {
        "monthlyCrossCheckCount": len(aligned),
        "medianReturnDifferenceBps": float(mismatch.median() * 10000),
        "maxReturnDifferenceBps": float(mismatch.max() * 10000),
        "marketDatesPrecedeDecisions": True,
    }
    f = f.reset_index(drop=True)
    f.to_csv(WORK / "dataset.csv", index=False)
    return f, feature["definitions"], quality


def train_indices(f, t, targets):
    values = f[targets].to_numpy(float)
    return np.flatnonzero(
        (f.target_end <= f.cutoff.iloc[t]).to_numpy() & np.isfinite(values).all(axis=1)
    )


def forecasts(f, block, alpha, assets):
    cols = BLOCKS[block]
    x = f[cols].to_numpy(float)
    targetcols = ["ret_" + a for a in assets]
    y = f[targetcols].to_numpy(float) - f[["ret_CASH"]].to_numpy(float)
    out = np.full_like(y, np.nan)
    sizes = np.zeros(len(f), int)
    for t in range(len(f)):
        train = train_indices(f, t, targetcols + ["ret_CASH"])
        if len(train) < MIN_TRAIN:
            continue
        assert (f.target_end.iloc[train] <= f.cutoff.iloc[t]).all()
        out[t] = ridge_predict(x[train], y[train], x[t], alpha)[0]
        sizes[t] = len(train)
    return out, sizes


def quadrant_codes(f, defs, g_factor=1.0, i_factor=1.0, band=0.15):
    scores = {}
    for group, factor in [("growth", g_factor), ("inflation", i_factor)]:
        subset = [d for d in defs if d["group"] == group]
        x = f[[d["id"] + "_delta" for d in subset]].to_numpy(float)
        w = np.array([d["weight"] for d in subset])
        scale = np.array([d["scale"] for d in subset]) * factor
        available = np.isfinite(x) @ w
        coverage = available / w.sum()
        z = np.clip(x / scale, -1, 1)
        score = np.nansum(z * w, axis=1) / np.where(available, available, np.nan)
        scores[group] = np.where(coverage >= 0.75, score, np.nan)
    g, i = scores["growth"], scores["inflation"]
    codes = np.full(len(f), -1, int)
    valid = np.isfinite(g) & np.isfinite(i)
    codes[valid & (g >= 0) & (i < 0)] = 0
    codes[valid & (g >= 0) & (i >= 0)] = 1
    codes[valid & (g < 0) & (i >= 0)] = 2
    codes[valid & (g < 0) & (i < 0)] = 3
    codes[valid & ((np.abs(g) < band) | (np.abs(i) < band))] = 4
    return codes


def quadrant_forecasts(f, codes, assets):
    targetcols = ["ret_" + a for a in assets]
    y = f[targetcols].to_numpy(float) - f[["ret_CASH"]].to_numpy(float)
    out = np.full_like(y, np.nan)
    for t in range(len(f)):
        train = train_indices(f, t, targetcols + ["ret_CASH"])
        train = train[codes[train] >= 0]
        if len(train) < MIN_TRAIN:
            continue
        if codes[t] < 0:
            out[t] = 0
            continue
        prior = y[train].mean(axis=0)
        cell = train[codes[train] == codes[t]]
        out[t] = (
            (len(cell) * y[cell].mean(axis=0) + 12 * prior) / (len(cell) + 12)
            if len(cell) >= 12
            else prior
        )
    return out


def weights_from_forecasts(pred, assets):
    weights = np.full((len(pred), len(ASSETS) + 1), np.nan)
    for t, row in enumerate(pred):
        if not np.isfinite(row).all():
            continue
        w = np.zeros(len(ASSETS) + 1)
        pick = int(np.argmax(np.r_[0, row]))
        w[0 if pick == 0 else ASSETS.index(assets[pick - 1]) + 1] = 1
        weights[t] = w
    return weights


def net_returns(weights, asset_returns, cost_bps=10):
    weights = np.asarray(weights, float)
    asset_returns = np.asarray(asset_returns, float)
    # Rebalance from drifted holdings, not last month's target weights. Even a
    # fixed 60/40 portfolio incurs turnover when its two legs earn different returns.
    prior = np.zeros_like(weights)
    prior[0, 0] = 1.0
    if len(weights) > 1:
        grown = weights[:-1] * np.where(
            np.isfinite(asset_returns[:-1]), 1 + asset_returns[:-1], 1.0
        )
        prior[1:] = grown / grown.sum(axis=1, keepdims=True)
    cost = np.abs(weights[:, 1:] - prior[:, 1:]).sum(axis=1) * cost_bps / 10000
    ret = np.nansum(weights * asset_returns, axis=1) - cost
    return ret, cost, np.abs(weights - prior).sum(axis=1) / 2


def metrics(ret, cash, turnover=None):
    ret = np.asarray(ret, float)
    cash = np.asarray(cash, float)
    eq = np.r_[1.0, np.cumprod(1 + ret)]
    dd = eq / np.maximum.accumulate(eq) - 1
    excess = ret - cash
    sd = np.std(excess, ddof=1)
    return {
        "months": len(ret),
        "cagr": float(eq[-1] ** (12 / len(ret)) - 1),
        "sharpe": float(np.mean(excess) / sd * np.sqrt(12)) if sd > 1e-12 else None,
        "volatility": float(np.std(ret, ddof=1) * np.sqrt(12)),
        "maxDrawdown": float(dd.min()),
        "totalReturn": float(eq[-1] - 1),
        "turnoverPerYear": (
            float(np.mean(turnover) * 12) if turnover is not None else 0.0
        ),
    }


def evaluate(f, weights, mask, cost=10):
    idx = np.flatnonzero(mask & np.isfinite(weights).all(axis=1))
    # Non-held assets with absent early inception returns do not become zeros in a held asset.
    r = f[["ret_CASH"] + ["ret_" + a for a in ASSETS]].to_numpy(float)[idx]
    if np.any((weights[idx] > 0) & ~np.isfinite(r)):
        raise ValueError("Missing held asset returns")
    ret, costs, turn = net_returns(weights[idx], r, cost)
    return metrics(ret, r[:, 0], turn), ret, idx


def selection_score(f, weights, dev):
    try:
        m, _, _ = evaluate(f, weights, dev)
    except (ValueError, ZeroDivisionError):
        return -np.inf
    return m["sharpe"] if m["months"] >= 36 and m["sharpe"] is not None else -np.inf


def constant_weights(f, allocation):
    w = np.zeros((len(f), len(ASSETS) + 1))
    for asset, value in allocation.items():
        w[:, 0 if asset == "CASH" else ASSETS.index(asset) + 1] = value
    return w


def bootstrap_advantage(a, b, seed=20261019, reps=2500):
    rng = np.random.default_rng(seed)
    n = len(a)
    diff = np.asarray(a) - np.asarray(b)
    indices = (
        rng.integers(0, n, size=(reps, math.ceil(n / 12), 1)) + np.arange(12)
    ).reshape(reps, -1)[:, :n] % n
    samples = diff[indices].mean(axis=1) * 12
    lo, hi = np.quantile(samples, [0.025, 0.975])
    return {
        "annualMeanReturnAdvantage": float(diff.mean() * 12),
        "lower95": float(lo),
        "upper95": float(hi),
        "blockMonths": 12,
        "replications": reps,
        "confirmedPositive": bool(lo > 0),
    }


def main():
    f, defs, quality = source_frames()
    dev = (f.target_end <= DEV_END).to_numpy()
    hold = ((f.target_end >= TEST_START) & (f.target_end <= TEST_END)).to_numpy()
    models = {}
    selections = {}
    development = []
    spy_cache = {}
    for block in BLOCKS:
        for alpha in ALPHAS:
            pred, sizes = forecasts(f, block, alpha, ["SPY"])
            w = weights_from_forecasts(pred, ["SPY"])
            score = selection_score(f, w, dev)
            key = f"{block}:{alpha:g}"
            spy_cache[key] = (w, pred, sizes)
            development.append(
                {
                    "candidate": key,
                    "scope": "SPY timing",
                    "developmentSharpe": float(score),
                }
            )
    best = max(spy_cache, key=lambda k: selection_score(f, spy_cache[k][0], dev))
    models["Predictive SPY"] = spy_cache[best][0]
    selections["spy"] = {
        "candidate": best,
        "trainedThrough": "rolling matured labels only",
        "features": BLOCKS[best.split(":")[0]],
    }
    rotation_cache = {}
    for block in ["macro", "combined"]:
        for alpha in ALPHAS:
            pred, sizes = forecasts(f, block, alpha, ASSETS)
            w = weights_from_forecasts(pred, ASSETS)
            key = f"{block}:{alpha:g}"
            rotation_cache[key] = (w, pred, sizes)
            development.append(
                {
                    "candidate": key,
                    "scope": "asset rotation",
                    "developmentSharpe": float(selection_score(f, w, dev)),
                }
            )
    best_rot = max(
        rotation_cache, key=lambda k: selection_score(f, rotation_cache[k][0], dev)
    )
    models["Predictive rotation"] = rotation_cache[best_rot][0]
    selections["rotation"] = {
        "candidate": best_rot,
        "features": BLOCKS[best_rot.split(":")[0]],
    }
    quad_cache = {}
    for gf in [0.75, 1.0, 1.25]:
        for inf in [0.75, 1.0, 1.25]:
            for band in [0.10, 0.15, 0.20]:
                code = quadrant_codes(f, defs, gf, inf, band)
                pred = quadrant_forecasts(f, code, ASSETS)
                w = weights_from_forecasts(pred, ASSETS)
                key = f"{gf:g}/{inf:g}/{band:g}"
                quad_cache[key] = w
                development.append(
                    {
                        "candidate": key,
                        "scope": "calibrated quadrant rotation",
                        "developmentSharpe": float(selection_score(f, w, dev)),
                    }
                )
    best_quad = max(quad_cache, key=lambda k: selection_score(f, quad_cache[k], dev))
    models["Calibrated quadrants"] = quad_cache[best_quad]
    selections["quadrants"] = {
        "growthScaleFactor": float(best_quad.split("/")[0]),
        "inflationScaleFactor": float(best_quad.split("/")[1]),
        "transitionBand": float(best_quad.split("/")[2]),
    }
    original = quadrant_codes(f, defs)
    original_w = constant_weights(f, {"CASH": 1})
    for k, asset in {0: "SPY", 1: "DBC", 2: "GLD", 3: "IEF"}.items():
        original_w[original == k] = constant_weights(f, {asset: 1})[original == k]
    models["Original quadrant map"] = original_w
    models["SPY buy & hold"] = constant_weights(f, {"SPY": 1})
    # Full static asset-class reference set; no additional model selection.
    for asset in ASSETS[1:]:
        models[f"{asset} buy & hold"] = constant_weights(f, {asset: 1})
    models["60/40 SPY/IEF"] = constant_weights(f, {"SPY": 0.6, "IEF": 0.4})
    models["Equal asset basket"] = constant_weights(f, {a: 0.2 for a in ASSETS})
    models["200-day market trend"] = constant_weights(f, {"CASH": 1})
    models["200-day market trend"][f.ma200.to_numpy() > 0] = constant_weights(
        f, {"SPY": 1}
    )[f.ma200.to_numpy() > 0]
    models["Cash proxy"] = constant_weights(f, {"CASH": 1})
    # Family and all hyperparameters are chosen above with development labels only.
    frozen = json.loads(json.dumps(selections))
    results = []
    net = {}
    annual = []
    for name, w in models.items():
        m, r, idx = evaluate(f, w, hold)
        stress, _, _ = evaluate(f, w, hold, 25)
        if len(idx) != 60:
            raise ValueError(f"{name}: holdout must keep all 60 months, got {len(idx)}")
        net[name] = r
        yearly = (
            pd.Series(r, index=f.target_end.iloc[idx])
            .groupby(f.target_end.iloc[idx].dt.year.to_numpy())
            .apply(lambda x: float(np.prod(1 + x) - 1))
        )
        annual.extend(
            {"strategy": name, "year": int(y), "return": v} for y, v in yearly.items()
        )
        result = {
            "name": name,
            **m,
            "cagrAt25bps": stress["cagr"],
            "spyExposure": float(w[idx, 1].mean()),
            "cashExposure": float(w[idx, 0].mean()),
        }
        results.append(result)
    for result in results:
        if result["name"] in [
            "Predictive SPY",
            "Predictive rotation",
            "Calibrated quadrants",
        ]:
            result["advantageVsSPY"] = bootstrap_advantage(
                net[result["name"]], net["SPY buy & hold"]
            )
    codes = quadrant_codes(f, defs)
    conditional = []
    for code, label in list(
        enumerate(
            [
                "Growth ↑ / Inflation ↓",
                "Growth ↑ / Inflation ↑",
                "Growth ↓ / Inflation ↑",
                "Growth ↓ / Inflation ↓",
                "Transition",
            ]
        )
    ) + [(-1, "Unavailable (cash fallback)")]:
        mask = hold & (codes == code)
        cell = f.loc[mask, ["ret_CASH"] + ["ret_" + a for a in ASSETS]]
        means = {a: float(cell["ret_" + a].mean()) for a in ["CASH"] + ASSETS}
        conditional.append(
            {
                "code": code,
                "label": label,
                "n": len(cell),
                "meanNextMonthReturns": means,
                "historicalLeader": max(means, key=means.get) if len(cell) else None,
                "smallSample": len(cell) < 12,
            }
        )
    lag = []
    prior_prices = (
        pd.read_csv(WORK / "prices/SPY.csv")
        .assign(month=lambda x: pd.to_datetime(x.timestamp).dt.to_period("M"))
        .set_index("month")["adjusted close"]
        .sort_index()
    )
    for axis in ["g", "i"]:
        for h in [1, 3, 6]:
            past = (
                (prior_prices / prior_prices.shift(h) - 1)
                .reindex(f.tradeDate.dt.to_period("M"))
                .to_numpy()
            )
            future = (
                (prior_prices.shift(-h) / prior_prices - 1)
                .reindex(f.tradeDate.dt.to_period("M"))
                .to_numpy()
            )
            for direction, values in [("trailing", past), ("forward", future)]:
                end = (
                    f.tradeDate + pd.DateOffset(months=h)
                    if direction == "forward"
                    else f.tradeDate
                )
                valid = (
                    np.isfinite(f[axis].to_numpy())
                    & np.isfinite(values)
                    & (end <= TEST_END).to_numpy()
                )
                lag.append(
                    {
                        "axis": axis,
                        "horizonMonths": h,
                        "direction": direction,
                        "n": int(valid.sum()),
                        "correlation": float(
                            np.corrcoef(f[axis].to_numpy()[valid], values[valid])[0, 1]
                        ),
                    }
                )
    latest = spy_cache[best][1][-1, 0]
    latest_rot = rotation_cache[best_rot][1][-1]
    prediction = {
        "asOf": str(f.cutoff.iloc[-1].date()),
        "tradeDate": str(f.tradeDate.iloc[-1].date()),
        "targetMonth": str(
            (f.tradeDate.iloc[-1] + pd.DateOffset(months=1)).to_period("M")
        ),
        "spyForecastExcessReturn": float(latest),
        "assetForecasts": dict(zip(ASSETS, map(float, latest_rot))),
        "allResearchOnly": True,
    }
    summary = {
        "version": "walk-forward-research-1",
        "asOf": "2026-10-19",
        "developmentLabelsEnd": "2020-11-30",
        "embargo": "December 2020 label excluded from model selection",
        "holdoutStart": "2021-01-01",
        "holdoutEnd": "2025-12-31",
        "holdingMonths": 1,
        "decisionRule": "ALFRED vintage and daily market features at least one calendar day before traded month-end close; labels mature by cutoff",
        "costBpsPerSide": 10,
        "cashAssumption": "TB3MS vintage yield held constant and compounded over actual holding days; approximate T-bill carry, not an investable total-return index",
        "assetNames": NAMES,
        "quality": quality,
        "sample": {
            "featureRows": len(f),
            "validOriginalQuadrants": int((original >= 0).sum()),
            "firstOriginalQuadrant": str(f.tradeDate[original >= 0].iloc[0].date()),
        },
        "selection": frozen,
        "candidateCount": len(development),
        "results": results,
        "annualReturns": annual,
        "conditionalReturns": conditional,
        "lagChecks": lag,
        "latestPrediction": prediction,
        "sources": [
            {
                "name": "Alpha Vantage monthly adjusted ETF data",
                "url": "https://www.alphavantage.co/documentation/#monthlyadj",
            },
            {
                "name": "Yahoo Finance SPY daily data",
                "url": "https://finance.yahoo.com/quote/SPY/history/",
            },
            {
                "name": "FRED/ALFRED vintage observations",
                "url": "https://fred.stlouisfed.org/docs/api/fred/series_observations.html",
            },
        ],
        "limitations": [
            "One 60-month holdout; model comparison and limited crisis coverage can overstate robustness.",
            "Conditional asset leaders are retrospective averages, not guarantees or statistically established winners.",
            "No taxes, financing, spreads or intramonth execution simulation; monthly drawdowns understate intramonth losses.",
            "Original quadrant inputs lack sufficient archived vintage coverage before 2011; no imputation creates an earlier original-regime history.",
            "Initial universe is selected ex ante by asset class; results do not establish performance over untested assets or currencies.",
        ],
        "protocolSha256": hashlib.sha256(
            (ROOT / "scripts/research/protocol.md").read_bytes()
        ).hexdigest(),
    }
    summary["vintageExamples"] = [
        {
            k: row[k]
            for k in [
                "cutoff",
                "tradeDate",
                "g",
                "i",
                "gdp_yoy",
                "pce_yoy",
                "inputDates",
            ]
        }
        for row in json.loads((WORK / "features.json").read_text(encoding="utf-8-sig"))[
            "rows"
        ]
        if row["cutoff"] in ["2020-03-30", "2020-09-29", "2022-06-29"]
    ]
    (WORK / "backtest-full.json").write_text(
        json.dumps(
            {"summary": summary, "development": development}, indent=2, allow_nan=False
        ),
        encoding="utf8",
    )
    (ROOT / "data/research-summary.json").write_text(
        json.dumps(summary, indent=2, allow_nan=False), encoding="utf8"
    )
    print(
        json.dumps(
            {
                "selection": frozen,
                "quality": quality,
                "results": [
                    {
                        k: r[k]
                        for k in ["name", "months", "cagr", "sharpe", "maxDrawdown"]
                    }
                    for r in results
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
