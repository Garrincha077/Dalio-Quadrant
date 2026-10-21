"""Point-in-time, native-frequency value and completed-month price scores."""
import hashlib
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / "work/research-v3"
BASE = ROOT / "work/research-v2"
ASSETS = ["SPY", "IEF", "GLD", "TIP", "DBC"]
DEFINITIONS = {
    "SPY": {"name": "US equities", "measure": "Nonfinancial corporate earnings-yield proxy", "unit": "%",
        "frequency": "quarterly", "direction": 1, "kind": "Fundamental proxy",
        "formula": "100 × mean(last 4 quarterly annualised NFCPATAX) / same-quarter equity market value in billions",
        "limitation": "US nonfinancial corporations, not S&P 500 constituents or CAPE; quarterly release lag.",
        "sourceIds": ["NFCPATAX", "NCBEILQ027S", "MVEONWMVBSNNCB"]},
    "IEF": {"name": "Nominal Treasuries", "measure": "10-year nominal Treasury yield", "unit": "%",
        "frequency": "monthly", "direction": 1, "kind": "Nominal carry proxy",
        "formula": "GS10 monthly constant-maturity yield",
        "limitation": "Nominal yield, not expected real return or the exact yield/duration of IEF.", "sourceIds": ["GS10"]},
    "GLD": {"name": "Gold", "measure": "Log real gold ETF price", "unit": "log ratio",
        "frequency": "monthly", "direction": -1, "kind": "Real-price proxy",
        "formula": "log(completed-month unadjusted GLD close / same-month CPIAUCSL)",
        "limitation": "Price-reversion proxy, not fundamental gold fair value; ETF expenses affect long history.",
        "sourceIds": ["CPIAUCSL"], "priceSource": "GLD"},
    "TIP": {"name": "Inflation-linked Treasuries", "measure": "10-year real Treasury yield", "unit": "%",
        "frequency": "monthly", "direction": 1, "kind": "Real-yield proxy",
        "formula": "FII10 monthly inflation-indexed constant-maturity yield",
        "limitation": "Constant-maturity real yield, not the exact yield/duration of TIP.", "sourceIds": ["FII10"]},
    "DBC": {"name": "Commodity futures", "measure": "Log producer prices relative to CPI", "unit": "log ratio",
        "frequency": "monthly", "direction": -1, "kind": "Relative-price proxy",
        "formula": "log(PPIACO / same-month CPIAUCSL)",
        "limitation": "Broad producer-price basket, not DBC holdings, commodity fair value or futures carry.",
        "sourceIds": ["PPIACO", "CPIAUCSL"]},
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def vintage(source, cutoff):
    """No current-history fallback; only the requested original-vintage column."""
    if not source or cutoff not in source.get("availableCutoffs", []):
        return []
    key = source["series"] + "_" + cutoff.replace("-", "")
    result = []
    for row in source["observations"]:
        try:
            value = float(row.get(key, "nan"))
        except (ValueError, TypeError):
            continue
        if np.isfinite(value) and row["date"] <= cutoff:
            result.append((row["date"], value))
    return result


def native(points, cutoff, frequency="M"):
    if not points:
        return pd.Series(dtype=float, index=pd.PeriodIndex([], freq=frequency))
    ix = pd.PeriodIndex([p[0] for p in points], freq=frequency)
    if ix.duplicated().any():
        raise ValueError("Duplicate native source period")
    s = pd.Series([p[1] for p in points], index=ix).sort_index()
    return s[s.index.to_timestamp(how="end").normalize() <= pd.Timestamp(cutoff)]


def split_adjusted_closes(frame, cutoff, splits):
    f = frame[(frame.timestamp <= cutoff) & (frame.timestamp.str[:7] < cutoff[:7])].copy()
    # Explicit completed-month test also covers cutoffs on the last calendar day.
    if len(f):
        f = f[pd.PeriodIndex(f.timestamp, freq="M").to_timestamp(how="end").normalize() <= pd.Timestamp(cutoff)]
    values = pd.to_numeric(f["close"], errors="raise").to_numpy(float)
    if not np.isfinite(values).all() or np.any(values <= 0):
        raise ValueError("Invalid unadjusted price")
    for event in splits:
        if event["date"] <= cutoff:
            ratio = event["numerator"] / event["denominator"]
            if not np.isfinite(ratio) or ratio <= 0:
                raise ValueError("Invalid split ratio")
            values[f.timestamp.to_numpy() < event["date"]] /= ratio
    periods = pd.PeriodIndex(f.timestamp, freq="M")
    if periods.duplicated().any():
        raise ValueError("Duplicate source price month")
    return pd.Series(values, index=periods).sort_index()


def score(series, cutoff, direction=1, years=10, quarterly=False, max_age=90):
    """Current observation is excluded from its own historical reference sample."""
    clean = series[np.isfinite(series)].sort_index()
    empty = {"z": None, "percentile": None, "n": 0, "reason": "No released matched-period input"}
    if clean.empty:
        return empty
    period, level = clean.index[-1], float(clean.iloc[-1])
    step, minimum = (4, 20) if quarterly else (12, 60)
    past = clean[(clean.index >= period - years * step) & (clean.index < period)]
    period_end = period.end_time.normalize().strftime("%Y-%m-%d")
    age = (pd.Timestamp(cutoff) - pd.Timestamp(period_end)).days
    result = {"z": None, "percentile": None, "level": level, "period": str(period),
        "periodEnd": period_end, "ageDays": age, "n": len(past), "years": years,
        "referenceFirst": str(past.index[0]) if len(past) else None,
        "referenceLast": str(past.index[-1]) if len(past) else None,
        "mean": float(past.mean()) if len(past) else None,
        "sd": float(past.std(ddof=1)) if len(past) > 1 else None, "reason": None}
    if age < 0 or age > max_age:
        result["reason"] = "Reference period is stale or has not ended"
    elif len(past) < minimum:
        result["reason"] = f"Needs at least {minimum} prior {'quarters' if quarterly else 'months'}"
    elif not np.isfinite(result["sd"]) or result["sd"] <= 1e-12:
        result["reason"] = "Historical dispersion is zero"
    else:
        result["z"] = direction * (level - result["mean"]) / result["sd"]
        percentile = 100 * (np.count_nonzero(past < level) + .5 * np.count_nonzero(past == level)) / len(past)
        result["percentile"] = percentile if direction == 1 else 100 - percentile
    return result


def equity_measure(profits, market_value):
    # Profits are SAAR billions. The mean of four annualised quarters is a
    # trailing-year profit amount; summing SAAR observations would multiply by 4.
    profits = profits.reindex(pd.period_range(profits.index.min(), profits.index.max(), freq="Q")) if len(profits) else profits
    annual = profits.rolling(4, min_periods=4).mean()
    aligned = pd.concat([annual.rename("profits"), market_value.rename("capitalisation")], axis=1).dropna()
    aligned = aligned[aligned.capitalisation > 0]
    return 100 * aligned.profits / aligned.capitalisation


def matched_log_ratio(a, b):
    f = pd.concat([a.rename("a"), b.rename("b")], axis=1).dropna()
    f = f[(f.a > 0) & (f.b > 0)]
    return np.log(f.a / f.b)


def build(allow_gaps=False):
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    if manifest["failures"] and not allow_gaps:
        raise ValueError("Source checks incomplete")
    if sha(BASE / "features.json") != manifest["baseFeatureSha256"]:
        raise ValueError("Macro inputs changed; reacquire matching value sources")
    raw = {s["id"]: json.loads((WORK / f"fred/{s['id']}.json").read_text()) for s in manifest["sources"]}
    units = {s["id"]: s["units"] for s in manifest["sources"]}
    for sid, expected in {"NCBEILQ027S": "Millions of U.S. Dollars", "MVEONWMVBSNNCB": "Billions of Dollars", "NFCPATAX": "Billions of Dollars"}.items():
        if sid in units and units[sid] != expected:
            raise ValueError("Equity source units drifted")
    prices = {a: pd.read_csv(BASE / f"prices/{a}.csv") for a in ASSETS}
    for asset in ASSETS:
        if asset in manifest["actions"] and sha(BASE / f"prices/{asset}.csv") != manifest["actions"][asset]["priceSha256"]:
            raise ValueError("Prices changed after split-history audit")
    base = json.loads((BASE / "features.json").read_text())
    overlap = []

    def row(cutoff, trade_date=None):
        ids = ["NFCPATAX", "NCBEILQ027S", "MVEONWMVBSNNCB", "GS10", "FII10", "CPIAUCSL", "PPIACO"]
        history = {sid: native(vintage(raw.get(sid), cutoff), cutoff, "Q" if sid in ["NFCPATAX", "NCBEILQ027S", "MVEONWMVBSNNCB"] else "M") for sid in ids}
        old, new = history["MVEONWMVBSNNCB"], history["NCBEILQ027S"] / 1000
        leg = "NCBEILQ027S" if len(new) else "MVEONWMVBSNNCB"
        # Compare only while both duplicate legs are actively updating, not a
        # discontinued 2018 snapshot against 2026 revisions.
        if len(old) and len(new) and cutoff <= "2018-03-08":
            pair = pd.concat([old.rename("old"), new.rename("new")], axis=1).dropna()
            if len(pair):
                latest = pair.iloc[-1]
                overlap.append({"cutoff": cutoff, "period": str(pair.index[-1]),
                    "relativeDifference": float(abs(latest.old / latest.new - 1))})
        market_value = new if leg == "NCBEILQ027S" else old
        measure = {"SPY": equity_measure(history["NFCPATAX"], market_value),
            "IEF": history["GS10"], "TIP": history["FII10"],
            "DBC": matched_log_ratio(history["PPIACO"], history["CPIAUCSL"])}
        closes = {a: split_adjusted_closes(prices[a], cutoff, manifest["actions"][a]["splits"]) if a in manifest["actions"]
            else pd.Series(dtype=float, index=pd.PeriodIndex([], freq="M")) for a in ASSETS}
        measure["GLD"] = matched_log_ratio(closes["GLD"], history["CPIAUCSL"])
        assets = {}
        for asset, definition in DEFINITIONS.items():
            quarterly = definition["frequency"] == "quarterly"
            value = score(measure[asset], cutoff, definition["direction"], quarterly=quarterly, max_age=185 if quarterly else 90)
            value["z20"] = score(measure[asset], cutoff, definition["direction"], years=20, quarterly=quarterly, max_age=185 if quarterly else 90)["z"]
            if asset == "SPY" and len(market_value):
                value["sourceLeg"] = leg
            price = score(np.log(closes[asset]), cutoff)
            price["z20"] = score(np.log(closes[asset]), cutoff, years=20)["z"]
            assets[asset] = {"value": value, "price": price}
        return {"month": trade_date[:7] if trade_date else cutoff[:7], "cutoff": cutoff,
            "tradeDate": trade_date, "assets": assets}

    rows = [row(r["cutoff"], r["tradeDate"]) for r in base["rows"]]
    latest = row(manifest["asOf"])
    worst = max((r["relativeDifference"] for r in overlap), default=None)
    # Billions in the discontinued duplicate are rounded to two decimals.
    if worst is not None and worst > .0001:
        raise ValueError("Documented equity duplicate failed overlap reconciliation")
    output = {"version": "value-price-features-3", "asOf": manifest["asOf"], "definitions": DEFINITIONS,
        "rows": rows, "latest": latest, "equityDuplicateAudit": {"n": len(overlap),
            "maxRelativeDifference": worst, "checks": overlap}, "sourceManifestSha256": sha(WORK / "source-manifest.json")}
    (WORK / "features.json").write_text(json.dumps(output, separators=(",", ":"), allow_nan=False))
    print(json.dumps({"decisions": len(rows), "valueComplete": sum(all(r["assets"][a]["value"]["z"] is not None for a in ASSETS) for r in rows),
        "priceComplete": sum(all(r["assets"][a]["price"]["z"] is not None for a in ASSETS) for r in rows),
        "equityDuplicateAudit": {"n": len(overlap), "maxRelativeDifference": worst}}))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-gaps", action="store_true")
    build(parser.parse_args().allow_gaps)
