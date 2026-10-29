"""Parse verified RELEASE dates, never infer publication from an observation month."""
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / "work/research-v2"


def parse_book(path, as_of):
    releases = pd.read_excel(path, sheet_name="release_dates", header=None)
    headers = [i for i, r in releases.iterrows()
               if r.iloc[0] == "release_date" and r.iloc[1] == "cfnai_month"]
    if len(headers) != 1:
        raise ValueError("Unrecognised Chicago release table")
    raw = pd.read_excel(path, sheet_name="cfnai_realtime", header=0)
    dates = pd.to_datetime(raw.iloc[:, 0], errors="coerce", format="mixed").dt.to_period("M")
    result = []
    for _, release in releases.iloc[headers[0]+1:].iterrows():
        stamp = pd.to_datetime(release.iloc[0], errors="coerce")
        ref = pd.to_datetime(release.iloc[1], errors="coerce")
        if pd.isna(stamp) or pd.isna(ref) or stamp.strftime("%Y-%m-%d") > as_of:
            continue
        key = f"CF3{ref.month}{ref.year}"
        if key not in raw:
            # Each workbook repeats the previous December's release metadata;
            # its actual column belongs to the preceding archive.
            if ref.year < int(path.name[:4]):
                continue
            raise ValueError("Release has no matching CFNAI-MA3 column")
        observations = [{"date": str(month) + "-01", "value": float(value)}
                        for month, value in zip(dates, raw[key])
                        if not pd.isna(month) and pd.notna(value) and month <= ref.to_period("M")]
        if observations:
            result.append({"releasedAt": stamp.strftime("%Y-%m-%d"),
                           "referenceMonth": ref.strftime("%Y-%m"),
                           "archive": path.name, "column": key, "observations": observations})
    return result


def main():
    manifest = json.loads((WORK / "source-manifest.json").read_text())
    rows = []
    for source in manifest["chicago"]:
        rows.extend(parse_book(WORK / f"chicago/{source['id']}.xlsx", manifest["asOf"]))
    rows.sort(key=lambda r: r["releasedAt"])
    if len({r["releasedAt"] for r in rows}) != len(rows):
        raise ValueError("Duplicate Chicago release dates")
    (WORK / "chicago-vintages.json").write_text(json.dumps(rows, separators=(",", ":")))
    print("Chicago verified releases:", len(rows), rows[0]["releasedAt"], rows[-1]["releasedAt"])


if __name__ == "__main__":
    main()
