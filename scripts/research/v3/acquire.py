"""Private, original-vintage sources for value and price z-scores."""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import time

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / "work/research-v3"
BASE = ROOT / "work/research-v2"
spec = importlib.util.spec_from_file_location("v2_acquire", HERE.parent / "v2/acquire.py")
source_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source_api)
IDS = ["NFCPATAX", "NCBEILQ027S", "MVEONWMVBSNNCB", "GS10", "FII10", "CPIAUCSL", "PPIACO"]
ASSETS = ["SPY", "IEF", "GLD", "TIP", "DBC"]


def fred_json(path, params, key):
    # Maintenance pages can return HTTP 200. Validate JSON before caching, and
    # never include request URLs (which contain credentials) in exceptions.
    for attempt in range(3):
        try:
            response = requests.get("https://api.stlouisfed.org/fred/" + path,
                params={**params, "api_key": key, "file_type": "json"}, timeout=45)
            data = response.json() if response.ok else {}
            if data and "error_code" not in data:
                return data
        except (requests.RequestException, ValueError):
            pass
        time.sleep(2 + attempt)
    raise RuntimeError("FRED JSON unavailable; maintenance, throttling or source failure")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def acquire(allow_gaps=False):
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "fred").mkdir(exist_ok=True)
    (WORK / "actions").mkdir(exist_ok=True)
    previous_manifest_path = WORK / "source-manifest.json"
    previous_manifest = json.loads(previous_manifest_path.read_text()) if previous_manifest_path.exists() else {}
    base = json.loads((BASE / "source-manifest.json").read_text())
    as_of = base["asOf"]
    if as_of > datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        raise ValueError("Future as-of date")
    cutoffs = sorted(set(base["cutoffs"] + [as_of]))
    key = source_api.load_key()

    def series(sid):
        path = WORK / f"fred/{sid}.json"
        cached = json.loads(path.read_text()) if path.exists() else {}
        # Reuse verified original vintages already acquired for v2. Its latest
        # response is valid only for the identical explicit as-of cutoff.
        if sid == "CPIAUCSL" and (cached.get("fetchedAsOf") != as_of or cached.get("cutoffs") != cutoffs):
            prior_path = BASE / "fred/CPIAUCSL.json"
            prior = json.loads(prior_path.read_text())
            if prior.get("fetchedAsOf") == as_of and all(c in prior["availableCutoffs"] for c in base["cutoffs"]):
                merged = {r["date"]: dict(r) for r in prior["observations"]}
                for r in prior["latest"]:
                    merged.setdefault(r["date"], {"date": r["date"]})[sid + "_" + as_of.replace("-", "")] = r["value"]
                cached = {"series": sid, "metadata": {"title": "Consumer Price Index for All Urban Consumers: All Items in U.S. City Average",
                    "units": "Index 1982-1984=100", "frequency": "Monthly",
                    "observation_start": prior["latest"][0]["date"], "observation_end": prior["latest"][-1]["date"]},
                    "vintageStart": prior["vintageStart"], "cutoffs": cutoffs,
                    "availableCutoffs": sorted(set(prior["availableCutoffs"] + [as_of])),
                    "fetchedAsOf": as_of, "observations": sorted(merged.values(), key=lambda r: r["date"]),
                    "cacheOrigin": {"study": "Verified v2 original-vintage acquisition", "sha256": sha(prior_path)}}
                path.write_text(json.dumps(cached, separators=(",", ":")))
        if cached.get("cutoffs") != cutoffs or cached.get("fetchedAsOf") != as_of:
            metadata = fred_json("series", {"series_id": sid}, key)["seriess"][0]
            first = fred_json("series/vintagedates", {"series_id": sid, "limit": 1, "sort_order": "asc"}, key)
            first_date = first["vintage_dates"][0]
            eligible = [d for d in cutoffs if d >= first_date]
            merged = {}
            for start in range(0, len(eligible), 40):
                offset = 0
                while True:
                    d = fred_json("series/observations", {"series_id": sid,
                        "vintage_dates": ",".join(eligible[start:start+40]), "output_type": 2,
                        "limit": 100000, "offset": offset, "sort_order": "asc"}, key)
                    observations = d.get("observations", [])
                    for row in observations:
                        merged.setdefault(row["date"], {}).update(row)
                    offset += len(observations)
                    if offset >= d["count"]:
                        break
                    if not observations:
                        raise ValueError("Truncated original-vintage source")
                time.sleep(.1)
            cached = {"series": sid, "metadata": metadata, "vintageStart": first_date,
                "cutoffs": cutoffs, "availableCutoffs": eligible, "fetchedAsOf": as_of,
                "observations": sorted(merged.values(), key=lambda r: r["date"])}
            path.write_text(json.dumps(cached, separators=(",", ":")))
        metadata = cached["metadata"]
        return {"id": sid, "title": metadata["title"], "units": metadata["units"],
            "frequency": metadata["frequency"], "firstVintage": cached["vintageStart"],
            "observationFirst": metadata["observation_start"], "observationLast": metadata["observation_end"],
            "url": f"https://fred.stlouisfed.org/series/{sid}", "sha256": sha(path)}

    sources, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        tasks = {pool.submit(series, sid): sid for sid in IDS}
        for task in concurrent.futures.as_completed(tasks):
            sid = tasks[task]
            try:
                sources.append(task.result())
                print(sid, "original vintages verified", flush=True)
            except Exception as error:
                failures.append({"id": sid, "reason": type(error).__name__})
                print(sid, "unavailable", flush=True)
    actions = {}
    for asset in ASSETS:
        try:
            path = WORK / f"actions/{asset}.json"
            if not path.exists() or previous_manifest.get("actions", {}).get(asset, {}).get("checkedAsOf") != as_of:
                d = None
                for host in ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]:
                    try:
                        response = requests.get(f"https://{host}/v8/finance/chart/{asset}", params={
                            "period1": 0, "period2": int(pd.Timestamp(as_of, tz="UTC").timestamp()) + 86400,
                            "interval": "1mo", "events": "splits", "includeAdjustedClose": "true"},
                            headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
                        candidate = response.json() if response.ok else {}
                        if candidate.get("chart", {}).get("result"):
                            d = candidate
                            break
                    except (requests.RequestException, ValueError):
                        pass
                if d is None:
                    raise RuntimeError("Corporate-action JSON unavailable")
                path.write_text(json.dumps(d, separators=(",", ":")))
            chart = json.loads(path.read_text())["chart"]["result"][0]
            if chart["meta"]["symbol"] != asset or not chart.get("timestamp"):
                raise ValueError("Wrong corporate-action history")
            first = pd.Timestamp(chart["timestamp"][0], unit="s", tz="UTC").strftime("%Y-%m-%d")
            last = pd.Timestamp(chart["timestamp"][-1], unit="s", tz="UTC").strftime("%Y-%m-%d")
            splits = []
            for event in chart.get("events", {}).get("splits", {}).values():
                date = pd.Timestamp(event["date"], unit="s", tz="UTC").strftime("%Y-%m-%d")
                numerator, denominator = float(event["numerator"]), float(event["denominator"])
                if numerator <= 0 or denominator <= 0:
                    raise ValueError("Invalid split ratio")
                if date <= as_of:
                    splits.append({"date": date, "numerator": numerator, "denominator": denominator})
            prices = pd.read_csv(BASE / f"prices/{asset}.csv")
            completed = prices[prices.timestamp.str[:7] < as_of[:7]]
            if first[:7] > completed.timestamp.min()[:7] or last[:7] < completed.timestamp.max()[:7]:
                raise ValueError("Corporate-action history does not cover source prices")
            actions[asset] = {"source": f"https://finance.yahoo.com/quote/{asset}/history/",
                "first": first, "last": last, "splits": sorted(splits, key=lambda x: x["date"]),
                "sha256": sha(path), "checkedAsOf": as_of,
                "priceSha256": sha(BASE / f"prices/{asset}.csv")}
            print(asset, "split history checked:", len(splits), flush=True)
        except Exception as error:
            failures.append({"id": f"{asset}-actions", "reason": type(error).__name__})
            print(asset, "split history unavailable", flush=True)
    manifest = {"version": "value-price-sources-3", "asOf": as_of, "cutoffs": cutoffs,
        "sources": sorted(sources, key=lambda x: x["id"]), "actions": actions, "failures": failures,
        "baseFeatureSha256": sha(BASE / "features.json"), "baseManifestSha256": sha(BASE / "source-manifest.json")}
    (WORK / "source-manifest.json").write_text(json.dumps(manifest, indent=2))
    if failures and not allow_gaps:
        raise RuntimeError("Required value/price source checks failed; previous public results retained")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-gaps", action="store_true", help="Record provider gaps explicitly; never invent missing observations")
    acquire(parser.parse_args().allow_gaps)
