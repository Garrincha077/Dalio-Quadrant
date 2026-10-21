"""Fixed ablations: value and price information beyond frozen macro features."""
import importlib.util
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / "work/research-v3"
BASE = ROOT / "work/research-v2"
spec = importlib.util.spec_from_file_location("research_v2_engine", HERE.parent / "v2/backtest.py")
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
ASSETS = engine.ASSETS
MODELS = ["mean", "macro", "value", "price", "macro-value", "macro-price", "full"]
LABELS = {"mean": "Historical average", "macro": "State + momentum", "value": "Value only",
    "price": "Price z only", "macro-value": "Macro + value", "macro-price": "Macro + price z",
    "full": "Macro + value + price z"}
PRIMARY = [("macro-value", "macro"), ("macro-value", "mean"), ("full", "macro-price"), ("full", "macro-value")]


def model_inputs(macro, value, price, model, asset):
    pieces = []
    if model in ["macro", "macro-value", "macro-price", "full"]:
        pieces.append(macro)
    if model in ["value", "macro-value", "full"]:
        pieces.append(value[:, [asset]])
    if model in ["price", "macro-price", "full"]:
        pieces.append(price[:, [asset]])
    return np.concatenate(pieces, axis=1) if pieces else np.zeros((len(macro), 0))


def forecasts(frame, value, price, y, target_end, require_value=True):
    macro = frame[engine.BLOCKS["combined"]].to_numpy(float)
    eligible = np.isfinite(macro).all(axis=1) & np.isfinite(price).all(axis=1)
    if require_value:
        eligible &= np.isfinite(value).all(axis=1)
    models = MODELS if require_value else ["mean", "macro", "price", "macro-price"]
    valid_y = np.isfinite(y).all(axis=1)
    predictions = {m: np.full_like(y, np.nan) for m in models}
    counts = np.zeros(len(frame), dtype=int)
    matrices = {(m, a): model_inputs(macro, value, price, m, a) for m in models for a in range(len(ASSETS))}
    for t in np.flatnonzero(eligible):
        train = np.flatnonzero(eligible & valid_y & (target_end <= np.datetime64(frame.cutoff.iloc[t])))
        counts[t] = len(train)
        if len(train) < 60:
            continue
        predictions["mean"][t] = y[train].mean(axis=0)
        for model in models[1:]:
            for a in range(len(ASSETS)):
                x = matrices[model, a]
                predictions[model][t, a] = engine.ridge_predict(x[train], y[train, a], x[t], 100)[0]
    return predictions, counts, eligible


def ranking_stats(predictions, y, common, clock):
    result = {}
    for model in predictions:
        ix = np.flatnonzero(common & np.isfinite(predictions[model]).all(axis=1))
        top = np.argmax(np.nan_to_num(predictions[model], nan=-np.inf), axis=1)
        result[model] = {"n": len(ix), "first": str(clock[ix[0]]) if len(ix) else None,
            "last": str(clock[ix[-1]]) if len(ix) else None,
            "meanRankIC": float(np.mean([engine.rank_ic(predictions[model][i], y[i]) for i in ix])) if len(ix) else None,
            "topAssetExcess": float(y[ix, top[ix]].mean()) if len(ix) else None}
    return result


def strategies(predictions, prices, clock, realised, cash):
    n = len(clock)
    targets = {}
    for model in predictions:
        target = np.zeros((n, len(ASSETS)))
        for t, p in enumerate(predictions[model]):
            if np.isfinite(p).all() and p.max() > 0:
                target[t, int(np.argmax(p))] = 1
        targets[model] = target
    targets["Equal five"] = np.tile([.2] * 5, (n, 1))
    targets["SPY"] = np.tile([1., 0, 0, 0, 0], (n, 1))
    targets["60/40"] = np.tile([.6, .4, 0, 0, 0], (n, 1))
    market = np.isfinite(realised).all(axis=1) & np.isfinite(cash)
    focus = "full" if "full" in predictions else "macro-price"
    forecast_available = np.isfinite(predictions[focus]).all(axis=1)
    starts = np.flatnonzero(forecast_available & market)
    mask = market.copy()
    if len(starts):
        mask[:starts[0]] = False
    else:
        mask[:] = False
    # Retain every later calendar month, including cash after a missing forecast.
    result = {}
    for name, target in targets.items():
        weights = np.array([engine.risk_weights(w, prices, clock, t) for t, w in enumerate(target)])
        strategy = engine.evaluate_strategy(weights, realised, cash, mask, clock)
        if strategy:
            strategy["selections"] = {a: int(np.count_nonzero(target[mask, i])) for i, a in enumerate(ASSETS)}
            strategy["selections"]["CASH"] = int(np.count_nonzero(target[mask].sum(axis=1) == 0))
        result[name] = strategy
    return result, mask, forecast_available


def run_horizon(frame, value, price, value20, price20, prices, clock, realised, cash, h, require_value=True):
    y, end = engine.labels(prices, clock, cash, h)
    predictions, counts, eligible = forecasts(frame, value, price, y, end, require_value)
    focus = "full" if require_value else "macro-price"
    common = np.isfinite(y).all(axis=1) & np.isfinite(predictions[focus]).all(axis=1)
    stats = ranking_stats(predictions, y, common, clock)
    ix = np.flatnonzero(common)
    comparisons = []
    if len(ix):
        lo, hi = ix[0], ix[-1] + 1
        ics = {m: np.array([engine.rank_ic(p, actual) if common[t] else np.nan
            for t, (p, actual) in enumerate(zip(predictions[m], y))]) for m in predictions}
        for model, against in (PRIMARY if require_value else [("macro-price", "macro"), ("macro-price", "mean")]):
            comparisons.append({"model": model, "against": against,
                **engine.bootstrap_difference(ics[model][lo:hi], ics[against][lo:hi], h)})
        if h == 12 and require_value:
            engine.holm(comparisons)
        else:
            for test in comparisons:
                test["exploratory"] = True
    policies, mask, available = strategies(predictions, prices, clock, realised, cash)
    rows = [{"month": str(clock[t]), "cutoff": frame.cutoff.iloc[t], "tradeDate": frame.tradeDate.iloc[t],
        "training": int(counts[t]), "common": bool(common[t]),
        "predictions": {m: predictions[m][t].tolist() for m in predictions}, "outcomes": y[t].tolist()}
        for t in range(len(frame)) if np.isfinite(predictions[focus][t]).all()]
    periods = {}
    for decade in range((clock[0].year // 10) * 10, clock[-1].year + 1, 10):
        selected = common & (clock.year >= decade) & (clock.year < decade + 10)
        if selected.any():
            periods[f"{decade}s"] = ranking_stats(predictions, y, selected, clock)
    # Fixed 20-year sensitivity, evaluated on its intersection with the primary
    # 10-year sample. It cannot change the primary model or its headline test.
    p20, _, _ = forecasts(frame, value20, price20, y, end, require_value)
    same = common & np.isfinite(p20[focus]).all(axis=1)
    sensitivity = {"status": "Exploratory fixed-window sensitivity", "n": int(same.sum()),
        "tenYears": ranking_stats(predictions, y, same, clock),
        "twentyYears": ranking_stats(p20, y, same, clock)}
    return {"models": stats, "comparisons": comparisons, "strategies": policies,
        "forecastRows": rows, "periods": periods, "sensitivity": sensitivity,
        "coverage": {"decisions": len(frame), "completeInputs": int(eligible.sum()),
            "missingInputs": int((~eligible).sum()), "commonEvaluationMonths": int(common.sum()),
            "strategyCalendarMonths": int(mask.sum()), "cashFallbackMonths": int((mask & ~available).sum())}}


def build(allow_gaps=False):
    source = json.loads((WORK / "source-manifest.json").read_text())
    features = json.loads((WORK / "features.json").read_text())
    if source["failures"] and not allow_gaps:
        raise ValueError("Original sources unavailable")
    if engine.sha(BASE / "features.json") != source["baseFeatureSha256"]:
        raise ValueError("Macro inputs changed after acquisition")
    base = json.loads((BASE / "features.json").read_text())
    frame = pd.DataFrame(base["rows"])
    if [r["cutoff"] for r in features["rows"]] != frame.cutoff.tolist():
        raise ValueError("Score and macro calendars differ")
    def matrix(kind, key):
        return np.array([[r["assets"][a][kind].get(key) for a in ASSETS] for r in features["rows"]], dtype=float)
    value, price, value20, price20 = matrix("value", "z"), matrix("price", "z"), matrix("value", "z20"), matrix("price", "z20")
    clock = pd.PeriodIndex(frame.tradeDate, freq="M")
    if clock.duplicated().any():
        raise ValueError("Duplicate decision month")
    prices = {a: engine.load_prices(BASE / f"prices/{a}.csv", source["asOf"]) for a in ASSETS}
    cash = np.full(len(frame), np.nan)
    for t in range(len(frame) - 1):
        if clock[t + 1] == clock[t] + 1 and pd.notna(frame.cashYield.iloc[t]):
            days = (pd.Timestamp(frame.tradeDate.iloc[t + 1]) - pd.Timestamp(frame.tradeDate.iloc[t])).days
            cash[t] = (1 + frame.cashYield.iloc[t] / 100) ** (days / 365) - 1
    realised = np.column_stack([prices[a].reindex(clock + 1).to_numpy() / prices[a].reindex(clock).to_numpy() - 1 for a in ASSETS])
    for t in range(len(frame)):
        if t + 1 == len(frame) or clock[t + 1] != clock[t] + 1:
            realised[t] = np.nan
    output = {"version": "value-price-research-3", "asOf": source["asOf"], "status": "retrospective-walk-forward",
        "primaryHorizon": 12, "protocolSha256": engine.sha(HERE / "protocol.md"),
        "inputSha256": engine.sha(WORK / "features.json"), "sourceManifestSha256": engine.sha(WORK / "source-manifest.json"),
        "assets": ASSETS, "modelLabels": LABELS, "definitions": features["definitions"],
        "sourceStatus": "partial" if source["failures"] else "complete", "sourceFailures": source["failures"],
        "latest": features["latest"], "scoreHistory": features["rows"], "sources": source["sources"],
        "splitAudits": source["actions"], "equityDuplicateAudit": features["equityDuplicateAudit"],
        "horizons": {}, "rules": {"minimumTraining": 60, "ridgeLambda": 100, "referenceYears": 10,
            "sensitivityYears": 20, "targetVolatility": .10, "riskHistoryMonths": 36, "costBps": 10,
            "stressCostBps": 25, "leverage": False, "primaryHypotheses": 4},
        "limitations": ["Retrospective extension designed after earlier research was inspected; no untouched holdout.",
            "Value measures differ by asset. Gold and commodities use price proxies, not fundamental fair value.",
            "Positive value z means relatively cheaper / higher yield; positive price z means above historical log price.",
            "Equal z-scores across assets do not imply equal expected returns or probabilities.",
            "Nominal Treasury yield is not expected real return; real Treasury yield is not the exact TIP portfolio yield.",
            "Monthly outcome windows overlap and are not independent observations.",
            "Latest scores are dated research snapshots using completed prices, not live quotes.",
            "Missing post-inception forecasts remain cash; all headline models share input and outcome eligibility.",
            "No confirmed predictive advantage is inferred from these historical results."]}
    for h in [3, 12, 36]:
        output["horizons"][str(h)] = run_horizon(frame, value, price, value20, price20, prices, clock, realised, cash, h)
        summary = output["horizons"][str(h)]
        summary["priceOnly"] = run_horizon(frame, value, price, value20, price20, prices, clock, realised, cash, h, False)
        print(json.dumps({"horizon": h, "fullExperiment": summary["coverage"],
            "exploratoryPriceExperiment": summary["priceOnly"]["coverage"],
            "priceRankIC": {m: s["meanRankIC"] for m, s in summary["priceOnly"]["models"].items()}}), flush=True)
    # Write a private candidate first. The independent verifier publishes only
    # after actual-source checks pass, preserving a previous good public file.
    (WORK / "research-candidate.json").write_text(json.dumps(engine.safe(output), separators=(",", ":"), allow_nan=False))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-gaps", action="store_true")
    build(parser.parse_args().allow_gaps)
