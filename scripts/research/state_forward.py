"""Descriptive state-conditioned forward returns; separate from frozen backtest."""

import csv
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
AS_OF = "2026-10-20"
ASSETS = {
    "SPY": "US equities",
    "IEF": "7–10Y Treasuries",
    "GLD": "Gold",
    "TIP": "Inflation-linked bonds",
    "DBC": "Broad commodities",
}
HORIZONS = (3, 12, 36)
LAGS = (0, 2)
QUADRANTS = ("above-above", "above-below", "below-above", "below-below", "boundary")
LABELS = (
    "Above trend / PCE >2%",
    "Above trend / PCE <2%",
    "Below trend / PCE >2%",
    "Below trend / PCE <2%",
    "Exactly on an anchor",
)


def classify(activity, inflation):
    if not np.isfinite(activity) or not np.isfinite(inflation):
        return None
    if activity == 0 or inflation == 2:
        return "boundary"
    return (
        ("above" if activity > 0 else "below")
        + "-"
        + ("above" if inflation > 2 else "below")
    )


def prices(path, as_of=AS_OF):
    frame = pd.read_csv(path)
    frame.index = pd.PeriodIndex(frame["timestamp"], freq="M")
    if frame.index.duplicated().any():
        raise ValueError("Duplicate price months")
    values = pd.to_numeric(frame["adjusted close"], errors="raise").sort_index()
    values = values[values.index < pd.Period(as_of, freq="M")]
    if not np.isfinite(values).all() or (values <= 0).any():
        raise ValueError("Invalid adjusted price")
    return values


def forward_return(values, month, horizon, lag=0):
    entry, exit_month = month + lag, month + lag + horizon
    required = pd.period_range(entry, exit_month, freq="M")
    if not required.isin(values.index).all():
        return None
    return float(values.loc[exit_month] / values.loc[entry] - 1)


def correlation(x, y):
    if len(x) < 3 or np.std(x) == 0 or np.std(y) == 0:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def bootstrap_lifts(values, categories, horizon, draws=2500):
    # Sample contiguous calendar blocks. Keep missing cohort months in the clock.
    n = len(values)
    if not n:
        return {}
    rng = np.random.default_rng(20261020)
    block = max(12, horizon)
    starts = rng.integers(0, n, size=(draws, int(np.ceil(n / block))))
    indices = ((starts[:, :, None] + np.arange(block)) % n).reshape(draws, -1)[:, :n]
    sampled = values[indices]
    sample_categories = categories[indices]
    valid = np.isfinite(sampled)
    overall = np.divide(
        np.nansum(sampled, axis=1),
        valid.sum(axis=1),
        out=np.full(draws, np.nan),
        where=valid.sum(axis=1) > 0,
    )
    result = {}
    for key in QUADRANTS:
        mask = valid & (sample_categories == key)
        count = mask.sum(axis=1)
        means = np.divide(
            np.where(mask, sampled, 0).sum(axis=1),
            count,
            out=np.full(draws, np.nan),
            where=count > 0,
        )
        diff = means - overall
        good = diff[np.isfinite(diff)]
        result[key] = {
            "validDraws": len(good),
            "interval": (
                np.quantile(good, [0.025, 0.975]).tolist()
                if len(good) >= 0.8 * draws
                else None
            ),
        }
    return result


def summarise(frame, horizon):
    eligible = frame.dropna(subset=["return"])
    if eligible.empty:
        return None
    lo, hi = eligible.index.min(), eligible.index.max()
    calendar = frame.reindex(pd.period_range(lo, hi, freq="M"))
    boot = bootstrap_lifts(
        calendar["return"].to_numpy(dtype=float),
        calendar["quadrant"].to_numpy(),
        horizon,
    )
    overall = float(eligible["return"].mean())
    cells, between = {}, 0.0
    for key in QUADRANTS:
        part = eligible[eligible.quadrant == key]
        vals = part["return"]
        if part.empty:
            cells[key] = {"n": 0}
            continue
        flags = (calendar["quadrant"] == key) & calendar["return"].notna()
        episodes = int((flags & ~flags.shift(1, fill_value=False)).sum())
        mean = float(vals.mean())
        between += len(vals) * (mean - overall) ** 2
        cells[key] = {
            "n": len(vals),
            "episodes": episodes,
            "first": str(part.index.min()),
            "last": str(part.index.max()),
            "mean": mean,
            "median": float(vals.median()),
            "positive": float((vals > 0).mean()),
            "p10": float(vals.quantile(0.1)),
            "p90": float(vals.quantile(0.9)),
            "lift": mean - overall,
            "liftCI": boot[key]["interval"],
            "bootstrapDraws": boot[key]["validDraws"],
            "correlation": correlation(
                (eligible.quadrant == key).astype(float), eligible["return"]
            ),
        }
    total = float(((eligible["return"] - overall) ** 2).sum())
    continuous = {}
    for axis in ("activity", "inflationGap"):
        continuous[axis] = {
            "pearson": correlation(eligible[axis], eligible["return"]),
            "spearman": correlation(eligible[axis].rank(), eligible["return"].rank()),
        }
    return {
        "n": len(eligible),
        "first": str(lo),
        "last": str(hi),
        "mean": overall,
        "median": float(eligible["return"].median()),
        "etaSquared": between / total if total else None,
        "continuous": continuous,
        "cells": cells,
    }


def build():
    source = ROOT / "work/state-history-sources.json"
    raw = json.loads(source.read_text(encoding="utf-8-sig"))

    def observations(key):
        return {
            pd.Period(x["date"], freq="M"): float(x["value"])
            for x in raw[key]["observations"]
            if x["value"] != "."
        }

    activity, pce = observations("CFNAIMA3"), observations("PCEPI")
    states = []
    for m, a in sorted(activity.items()):
        if m >= pd.Period(AS_OF, freq="M") or m not in pce or m - 12 not in pce:
            continue
        inflation = 100 * (pce[m] / pce[m - 12] - 1)
        states.append(
            {
                "month": m,
                "activity": a,
                "inflation": inflation,
                "inflationGap": inflation - 2,
                "quadrant": classify(a, inflation),
            }
        )
    state = pd.DataFrame(states).set_index("month")
    inputs = [source, Path(__file__).with_name("state-forward-protocol.md")]
    values, coverage = {}, {}
    for asset in ASSETS:
        path = ROOT / f"work/research/prices/{asset}.csv"
        inputs.append(path)
        values[asset] = prices(path)
        p = values[asset]
        coverage[asset] = {
            "firstPrice": str(p.index.min()),
            "lastPrice": str(p.index.max()),
            "priceMonths": len(p),
            "missingMonths": len(
                pd.period_range(p.index.min(), p.index.max(), freq="M").difference(
                    p.index
                )
            ),
        }
    matrices = {}
    for lag in LAGS:
        for horizon in HORIZONS:
            matrices[lag, horizon] = pd.DataFrame(
                {
                    asset: [
                        forward_return(values[asset], m, horizon, lag)
                        for m in state.index
                    ]
                    for asset in ASSETS
                },
                index=state.index,
                dtype=float,
            )
    cohorts = {}
    for lag in LAGS:
        cohorts[str(lag)] = {}
        for horizon in HORIZONS:
            matrix = matrices[lag, horizon]
            cohorts[str(lag)][str(horizon)] = {}
            for mode in ("asset", "common"):
                cohort = {}
                for asset in ASSETS:
                    frame = state.copy()
                    frame["return"] = matrix[asset]
                    if mode == "common":
                        frame.loc[~matrix.notna().all(axis=1), "return"] = np.nan
                    cohort[asset] = summarise(frame, horizon)
                cohorts[str(lag)][str(horizon)][mode] = cohort
    points = []
    for m, row in state.iterrows():
        returns = {
            str(lag): {
                a: [
                    (
                        None
                        if pd.isna(matrices[lag, h].loc[m, a])
                        else float(matrices[lag, h].loc[m, a])
                    )
                    for h in HORIZONS
                ]
                for a in ASSETS
            }
            for lag in LAGS
        }
        points.append(
            {
                "month": str(m),
                "activity": row.activity,
                "inflation": row.inflation,
                "quadrant": row.quadrant,
                "returns": returns,
            }
        )
    data = {
        "version": "state-forward-1",
        "asOf": AS_OF,
        "lastPriceMonth": max(x["lastPrice"] for x in coverage.values()),
        "assets": ASSETS,
        "quadrants": dict(zip(QUADRANTS, LABELS)),
        "horizons": HORIZONS,
        "lags": LAGS,
        "stateCoverage": {
            "first": str(state.index.min()),
            "last": str(state.index.max()),
            "n": len(state),
        },
        "priceCoverage": coverage,
        "bootstrap": {
            "draws": 2500,
            "seed": 20261020,
            "blockMonths": "max(12, horizon)",
            "adjustedForMultipleTesting": False,
        },
        "sourceHashes": {
            str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in inputs
        },
        "cohorts": cohorts,
        "points": points,
    }
    output = ROOT / "data/state-forward.json"
    output.write_text(
        json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
    )
    # Derived outcomes only; no provider price levels are redistributed.
    with (ROOT / "data/state-forward.csv").open(
        "w", newline="", encoding="utf-8"
    ) as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "state_month",
                "activity",
                "pce_yoy_pct",
                "quadrant",
                "asset",
                "entry_lag_months",
                "entry_month",
                "exit_month",
                "horizon_months",
                "cumulative_return_pct",
                "outcome_status",
                "research_as_of",
            ]
        )
        for point in points:
            m = pd.Period(point["month"], freq="M")
            for lag in LAGS:
                for asset in ASSETS:
                    for i, horizon in enumerate(HORIZONS):
                        r = point["returns"][str(lag)][asset][i]
                        status = (
                            "available"
                            if r is not None
                            else (
                                "future_not_complete"
                                if m + lag + horizon > values[asset].index.max()
                                else "price_history_unavailable"
                            )
                        )
                        writer.writerow(
                            [
                                str(m),
                                point["activity"],
                                point["inflation"],
                                point["quadrant"],
                                asset,
                                lag,
                                str(m + lag),
                                str(m + lag + horizon),
                                horizon,
                                "" if r is None else 100 * r,
                                status,
                                AS_OF,
                            ]
                        )
    return data


if __name__ == "__main__":
    result = build()
    lines = [
        "# Static state and subsequent asset returns",
        "",
        f"Frozen descriptive research as of {AS_OF}. Complete adjusted prices end September 2026.",
        "",
        "## One-year common-date results",
        "",
        "Reference-month entry; 235 monthly starts, March 2006–September 2025.",
        "All values are cumulative nominal USD returns, without costs. N counts overlapping",
        "monthly windows. A state below 2% PCE is not necessarily deflation.",
        "",
        "| State | N | SPY | IEF | GLD | TIP | DBC |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    cohort = result["cohorts"]["0"]["12"]["common"]
    percent = lambda v: f"{100*v:+.2f}%"
    for q, label in zip(QUADRANTS, LABELS):
        lines.append(
            f"| {label} | {cohort['SPY']['cells'][q]['n']} | "
            + " | ".join(percent(cohort[a]["cells"][q]["mean"]) for a in ASSETS)
            + " |"
        )
    lines.append(
        "| Unconditional same-cohort mean | 235 | "
        + " | ".join(percent(cohort[a]["mean"]) for a in ASSETS)
        + " |"
    )
    lines += [
        "",
        "## Highest mean among the four quadrants",
        "",
        "Exact-anchor cases are retained in the study, but are not a fifth ranked quadrant.",
        "These are retrospective leaders, not selected trading rules.",
        "",
        "| Asset | Horizon | Leading state | Mean | Median | N / episodes | Lift vs own baseline · pp | 95% block interval · pp |",
        "|---|---:|---|---:|---:|---:|---:|---|",
    ]
    for h in HORIZONS:
        for a in ASSETS:
            r = result["cohorts"]["0"][str(h)]["common"][a]
            q = max(QUADRANTS[:4], key=lambda q: r["cells"][q]["mean"])
            c = r["cells"][q]
            interval = (
                " to ".join(f"{100*v:+.2f}" for v in c["liftCI"])
                if c["liftCI"]
                else "unavailable"
            )
            lines.append(
                f"| {a} | {h}M | {result['quadrants'][q]} | {percent(c['mean'])} | {percent(c['median'])} | {c['n']} / {c['episodes']} | {100*c['lift']:+.2f} | {interval} |"
            )
    lines += [
        "",
        "SPY's one-year leader is below-trend activity / PCE below 2%: +17.17%,",
        "versus its +12.26% unconditional cohort mean. Its lift interval includes zero.",
        "Gold's one-year leader is below-trend activity / PCE above 2%: +20.88%",
        "versus +11.53% unconditional. These in-sample, unadjusted intervals do not",
        "remove revision/look-ahead bias or establish a forecasting edge.",
        "",
        "## Publication-delay sensitivity",
        "",
        "Two-month-delayed entry, then a full 12-month holding period: 235 common state",
        "months, January 2006–July 2025. For SPY, below-trend / PCE below 2% remains",
        "the four-quadrant mean leader (+17.00%). For GLD, below-trend / PCE above",
        "2% remains the leader (+23.12%). Commodity returns after above-trend / PCE",
        "above 2% average +14.19%; their lift interval now includes zero. Both modes",
        "use revised economic data. A delay is not a substitute for historical vintages.",
        "",
        "## Coverage and limitations",
        "",
        "712 revised economic states cover May 1967–August 2026, but returns exist only",
        "where ETF price histories allow. Price levels begin SPY December 1999, IEF",
        "August 2002, GLD December 2004, TIP January 2004 and DBC March 2006.",
        "The common reference cohort ends June 2026 for 3M outcomes, September 2025",
        "for 12M and September 2023 for 36M. Cohorts differ by horizon; 36M returns",
        "are cumulative, not annualised. Each-asset maximum-history results are also",
        "included in the app; comparisons across assets should use common dates.",
        "",
        "Adjusted closes are a provider total-return proxy. There are no costs, taxes,",
        "financing, shorts or leverage. All intervening monthly prices are required.",
        "Near-boundary states are retained. Only two common-date states are exactly",
        "on an anchor; their attractive-looking averages are especially fragile.",
        "The fixed 2% anchor predates the Fed's explicit 2012 objective in early history.",
        "",
        "Quadrants are categorical. One-versus-rest point-biserial correlations and",
        "categorical eta² measure sample association; Pearson/Spearman correlations",
        "separately describe continuous activity and inflation gaps. No numeric IDs",
        "are used as ordinal quadrant scores. All are descriptive, not causal.",
        "",
        "Overlapping outcomes are addressed with 2,500 paired circular moving-block",
        "resamples, block length max(12, horizon), seed 20261020. Intervals estimate",
        "conditional-minus-unconditional mean uncertainty, not future-return ranges.",
        "They are exploratory, without correction for multiple comparisons, selected",
        "ranks, structural breaks or all data revisions. Episodes are not independent",
        "trials either. Full state history is not full investable price history.",
        "",
        "## Reproduce and inspect",
        "",
        "Raw input locations and SHA-256 hashes are recorded in `data/state-forward.json`.",
        "Keep provider monthly adjusted CSVs in ignored `work/research/prices/`.",
        "Keep full FRED CFNAIMA3 and PCEPI observations in ignored",
        "`work/state-history-sources.json` as `{SERIES: {observations: [{date, value}]}}`.",
        "The builder rejects duplicate/invalid price months and excludes the partial",
        "October row. It emits derived outcomes only, not provider price levels.",
        "",
        "```sh",
        "python scripts/research/state_forward.py",
        "python scripts/research/test_state_forward.py",
        "node scripts/research/verify-state-forward.mjs",
        "npm test",
        "```",
        "",
        "The independent Node verifier recomputes all 712 classifications and 21,360",
        "point/asset/lag/horizon outcomes from actual sources, plus all 60 cohorts'",
        "counts, means, medians and positive-return rates without Python helpers.",
        "The 95% intervals are separately checked with synthetic dependent samples.",
        "See [static-state specification](state-forward-protocol.md). The previous",
        "[momentum protocol](protocol.md) and investment-model parameters are unchanged.",
        "",
        "Sources: [CFNAI-MA3](https://fred.stlouisfed.org/series/CFNAIMA3),",
        "[PCE](https://fred.stlouisfed.org/series/PCEPI),",
        "[monthly adjusted data](https://www.alphavantage.co/documentation/#monthlyadj),",
        "[Fed 2012 objective](https://www.federalreserve.gov/newsevents/pressreleases/monetary20120125c.htm).",
        "",
    ]
    Path(__file__).with_name("STATE_FORWARD.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "stateCoverage": result["stateCoverage"],
                "priceCoverage": result["priceCoverage"],
                "outputs": [
                    "data/state-forward.json",
                    "data/state-forward.csv",
                    "scripts/research/STATE_FORWARD.md",
                ],
            },
            indent=2,
        )
    )
