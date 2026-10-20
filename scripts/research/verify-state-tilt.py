"""Independent check of live recommendation maths against private source prices.

First save an API response as work/tilt-dashboard.json and buildStateTilt's three
horizon outputs as work/tilt-actual.json (now=2026-10-20T12:00:00Z for this audit).
Does not import or use the JavaScript algorithm or state-forward return helpers.
"""

import json
import math
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]


def verify():
    raw = json.loads(
        (ROOT / "work/state-history-sources.json").read_text(encoding="utf-8-sig")
    )
    snapshot = json.loads(
        (ROOT / "work/tilt-dashboard.json").read_text(encoding="utf-8-sig")
    )
    report = json.loads(
        (ROOT / "work/tilt-actual.json").read_text(encoding="utf-8-sig")
    )
    assets = ["SPY", "IEF", "GLD", "TIP", "DBC"]

    def series(key):
        return pd.Series(
            {
                pd.Period(p["date"], freq="M"): float(p["value"])
                for p in raw[key]["observations"]
                if p["value"] != "."
            }
        ).sort_index()

    a, p = series("CFNAIMA3"), series("PCEPI")
    macro = pd.DataFrame(
        {"activity": a, "inflation": 100 * (p / p.shift(12) - 1)}
    ).dropna()
    macro = macro.reindex(
        pd.period_range(macro.index.min(), macro.index.max(), freq="M")
    )
    direction = lambda v, band: (
        "rising" if v > band + 1e-9 else "falling" if v < -band - 1e-9 else "flat"
    )

    def trend(m, frame):
        part = frame.reindex(pd.period_range(m - 3, m, freq="M"))
        if part.isna().any().any():
            return None
        delta = part.iloc[-1] - part.iloc[0]
        return direction(delta.activity, 0.1) + "/" + direction(delta.inflation, 0.2)

    def group(row):
        if row.activity == 0 or row.inflation == 2:
            return "boundary"
        return (
            ("above" if row.activity > 0 else "below")
            + "-"
            + ("above" if row.inflation > 2 else "below")
        )

    macro["quadrant"] = [group(row) for _, row in macro.iterrows()]
    # Only the numerical columns enter trend availability checks.
    numeric = macro[["activity", "inflation"]]
    macro["trend"] = [trend(m, numeric) for m in macro.index]
    prices = {}
    for asset in assets:
        csv = pd.read_csv(ROOT / f"work/research/prices/{asset}.csv")
        prices[asset] = {
            pd.Period(row["timestamp"], freq="M"): float(row["adjusted close"])
            for _, row in csv.iterrows()
        }
    state = snapshot["economicState"]
    reference = pd.Period(state["activity"]["date"], freq="M")
    live = pd.DataFrame(snapshot["stateHistory"]["history"]).set_index("date")[
        ["activity", "inflation"]
    ]
    live.index = pd.PeriodIndex(live.index, freq="M")
    live.loc[reference] = [state["activity"]["value"], state["inflation"]["value"]]
    key = trend(reference, live)
    x, y = live.loc[reference]
    above = np.clip((x + 0.1) / 0.2, 0, 1)
    high = np.clip((y - 2 + 0.2) / 0.4, 0, 1)
    memberships = {
        "above-above": above * high,
        "above-below": above * (1 - high),
        "below-above": (1 - above) * high,
        "below-below": (1 - above) * (1 - high),
    }
    checks = 0

    def close(actual, expected):
        nonlocal checks
        assert math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10), (
            actual,
            expected,
        )
        checks += 1

    for result in report["results"]:
        horizon = result["horizon"]
        cutoff = min(
            pd.Period(report["now"][:7], freq="M") - 1,
            pd.Period(result["priceCutoff"], freq="M"),
        )
        selected, outcomes = [], []
        for m, row in macro.iterrows():
            if row.trend is None or m + 2 + horizon > cutoff:
                continue
            months = pd.period_range(m + 2, m + 2 + horizon, freq="M")
            if not all(all(t in prices[asset] for t in months) for asset in assets):
                continue
            selected.append(m)
            outcomes.append(
                [
                    prices[asset][m + 2 + horizon] / prices[asset][m + 2] - 1
                    for asset in assets
                ]
            )
        cohort = macro.loc[selected]
        returns = np.array(outcomes)
        weights = np.zeros(len(cohort))
        matches = np.zeros(len(cohort), dtype=bool)
        for quadrant, membership in memberships.items():
            if membership <= 1e-12:
                continue
            parent = (cohort.quadrant == quadrant).to_numpy()
            joint = parent & (cohort.trend == key).to_numpy()
            nq, nt = int(parent.sum()), int(joint.sum())
            parent_distribution = np.full(len(cohort), 24 / (nq + 24) / len(cohort))
            if nq:
                parent_distribution[parent] += nq / (nq + 24) / nq
            distribution = 24 / (nt + 24) * parent_distribution
            if nt:
                distribution[joint] += nt / (nt + 24) / nt
            weights += membership * distribution
            matches |= joint
        close(weights.sum(), 1)
        assert result["cohort"]["n"] == len(cohort)
        assert result["cohort"]["first"] == str(cohort.index[0])
        assert result["cohort"]["last"] == str(cohort.index[-1])
        assert result["cohort"]["matches"] == int(matches.sum())
        assert result["trend"]["key"] == key
        for j, asset in enumerate(assets):
            expected = next(row for row in result["ranking"] if row["asset"] == asset)
            values = returns[:, j]
            close(expected["mean"], np.dot(values, weights))
            close(expected["baseline"], values.mean())
            close(expected["lossFrequency"], weights[values < 0].sum())
            order = np.argsort(values, kind="stable")
            for field, probability in [("median", 0.5), ("p10", 0.1)]:
                index = np.searchsorted(np.cumsum(weights[order]), probability - 1e-12)
                close(expected[field], values[order[index]])
    print(
        json.dumps(
            {
                "horizons": 3,
                "independentNumericalChecks": checks,
                "reference": str(reference),
                "trend": key,
                "status": "Source prices, cohort eligibility, pooled means, baselines, loss frequencies and weighted quantiles agree",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    verify()
