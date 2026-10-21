"""Acquire original sources privately; no keys or raw price levels enter public files."""
import argparse
import concurrent.futures
import hashlib
import html
import io
import json
import os
from pathlib import Path
import re
import time
import zipfile

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / "work/research-v2"


def request(url, **kwargs):
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=90, **kwargs)
            if r.ok:
                return r
        except requests.RequestException:
            pass
        time.sleep(1 + attempt)
    # Do not include the request URL: it may contain an API key.
    raise RuntimeError("Source request failed after three attempts")


def fred(path, params, key):
    r = request("https://api.stlouisfed.org/fred/" + path,
                params={**params, "api_key": key, "file_type": "json"})
    data = r.json()
    if "error_code" in data:
        raise RuntimeError("FRED rejected source request")
    return data


def load_key():
    key = os.environ.get("FRED_API_KEY")
    if not key:
        env = ROOT / ".env.local"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith("FRED_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        raise RuntimeError("FRED_API_KEY is required in the environment or ignored .env.local")
    return key


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def acquire(as_of, next_trade_date=None):
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "fred").mkdir(exist_ok=True)
    (WORK / "chicago").mkdir(exist_ok=True)
    key = load_key()
    defs = json.loads((WORK / "definitions.json").read_text())
    spy = pd.read_csv(WORK / "prices/SPY.csv")
    dates = sorted(d for d in spy.timestamp if d[:7] < as_of[:7])
    if as_of > pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d"):
        raise ValueError("Source as-of date cannot be in the future")
    if next_trade_date:
        trade = pd.Timestamp(next_trade_date)
        cutoff = (trade-pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        if cutoff > as_of or trade.dayofweek >= 5 or trade.strftime("%Y-%m") != as_of[:7] or next_trade_date <= dates[-1]:
            raise ValueError("Planned execution needs a known preceding cutoff, a weekday and the current month")
        dates.append(next_trade_date)
    cutoffs = [(pd.Timestamp(d) - pd.Timedelta(days=1)).strftime("%Y-%m-%d") for d in dates]
    ids = list(dict.fromkeys([d["series"] for d in defs] + ["CFNAIMA3", "PCEPI", "TB3MS"]))
    sources, failures = [], []

    def series(id):
        path = WORK / f"fred/{id}.json"
        if path.exists():
            cached = json.loads(path.read_text())
            if cached.get("cutoffs") == cutoffs and cached.get("fetchedAsOf") == as_of:
                return {"id": id, "sha256": digest(path), "vintageStart": cached.get("vintageStart"),
                        "first": cached["latest"][0]["date"], "status": "verified"}
        first = fred("series/vintagedates", {"series_id": id, "sort_order": "asc", "limit": 1}, key)
        first_date = (first.get("vintage_dates") or [as_of])[0]
        eligible = [d for d in cutoffs if d >= first_date]
        merged = {}
        # Chunk wide vintages to keep response and URL sizes bounded. Paginate rows too.
        for start in range(0, len(eligible), 48):
            offset = 0
            while True:
                data = fred("series/observations", {"series_id": id,
                    "vintage_dates": ",".join(eligible[start:start+48]), "output_type": 2,
                    "limit": 100000, "offset": offset, "sort_order": "asc"}, key)
                obs = data.get("observations", [])
                for row in obs:
                    merged.setdefault(row["date"], {}).update(row)
                offset += len(obs)
                if offset >= data.get("count", 0):
                    break
                if not obs:
                    raise ValueError("Truncated vintage pagination")
        latest = fred("series/observations", {"series_id": id, "realtime_start": as_of,
                      "realtime_end": as_of, "limit": 100000, "sort_order": "asc"}, key)
        if len(latest["observations"]) != latest["count"]:
            raise ValueError("Truncated latest history")
        payload = {"series": id, "cutoffs": cutoffs, "vintageStart": first_date,
                   "availableCutoffs": eligible, "fetchedAsOf": as_of,
                   "observations": sorted(merged.values(), key=lambda x: x["date"]),
                   "latest": latest["observations"]}
        path.write_text(json.dumps(payload, separators=(",", ":")))
        return {"id": id, "sha256": digest(path), "vintageStart": first_date,
                "first": latest["observations"][0]["date"], "status": "verified"}

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        tasks = {pool.submit(series, id): id for id in ids}
        for task in concurrent.futures.as_completed(tasks):
            id = tasks[task]
            try:
                sources.append(task.result())
                print(id, "verified", flush=True)
            except Exception as error:
                failures.append({"id": id, "reason": type(error).__name__})
                print(id, "unavailable", flush=True)

    chicago = []
    page_url = "https://www.chicagofed.org/research/data/cfnai/cfnai-historical-data-preview"
    try:
        page = request(page_url).text
        links = re.findall(r'href="([^"]+)"[^>]*>(2001-2011|2012-2018|2019-present)', page)
        for href, name in links:
            url = "https://www.chicagofed.org" + html.unescape(href) if href.startswith("/") else html.unescape(href)
            path = WORK / f"chicago/{name}.xlsx"
            if not path.exists():
                path.write_bytes(request(url).content)
            book = pd.ExcelFile(path)
            chicago.append({"id": name, "url": url, "sha256": digest(path), "sheets": book.sheet_names})
        if not chicago:
            failures.append({"id": "chicago", "reason": "No original archive links"})
    except Exception as error:
        failures.append({"id": "chicago", "reason": type(error).__name__})

    # Separate annual US context; never an input to monthly strategy evaluation.
    context = None
    try:
        page = request("https://www.macrohistory.net/database/").text
        hrefs = re.findall(r'href=["\x27]([^"\x27]+)', page)
        href = next(h for h in hrefs if "JSTdatasetR6.xlsx" in h)
        url = "https://www.macrohistory.net" + html.unescape(href) if href.startswith("/") else html.unescape(href)
        path = WORK / "jst-source.xlsx"
        if not path.exists():
            path.write_bytes(request(url).content)
        frame = pd.read_excel(path)
        us = frame[frame.iso == "USA"]
        context = {"url": url, "sha256": digest(path), "first": int(us.year.min()),
                   "last": int(us.year.max()), "frequency": "annual", "license": "CC BY-NC-SA 4.0"}
    except Exception as error:
        failures.append({"id": "long-context", "reason": type(error).__name__})
    equity_context = None
    try:
        url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip"
        path = WORK / "french.zip"
        path.write_bytes(request(url).content)
        with zipfile.ZipFile(path) as book:
            if not any(n.endswith('.csv') for n in book.namelist()):
                raise ValueError('Expected original monthly factor CSV')
        equity_context = {"url": url, "sha256": digest(path), "frequency": "monthly",
                          "role": "Separate broad-US-equity descriptive context"}
    except Exception as error:
        failures.append({"id": "monthly-equity-context", "reason": type(error).__name__})
    sources.sort(key=lambda s: s["id"])
    manifest = {"version": "sources-v2", "asOf": as_of, "tradingDates": dates,
                "cutoffs": cutoffs, "series": ids, "sources": sources,
                "chicago": chicago, "context": context, "equityContext": equity_context, "failures": failures}
    (WORK / "source-manifest.json").write_text(json.dumps(manifest, indent=2))
    print("Source manifest:", len(sources), "FRED series;", len(chicago), "Chicago archives;", len(failures), "gaps", flush=True)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", default=pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d"))
    parser.add_argument("--next-trade-date", help="Verified planned month-end execution; cutoff must already be available")
    args = parser.parse_args()
    acquire(args.as_of, args.next_trade_date)
