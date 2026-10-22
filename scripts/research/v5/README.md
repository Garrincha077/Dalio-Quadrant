# Bottoming 0–3: original rules and a verified HY history extension

The supplied screenshots define stress severity using completed weekly S&P 500
RSI, VIX close and high-yield option-adjusted spreads in percent:

| Level | Name | RSI ≤ | VIX ≥ | HY OAS ≥ | Required |
|---|---|---:|---:|---:|---|
| 0 | No signal | | | | L1 not satisfied |
| 1 | Bull Reset | 40 | 25 | 4.5% | Any two |
| 2 | Cyclical Bottom | 33 | 30 | 6% | Any two |
| 3 | Systemic Bottom | 30 | 40 | 8% | All three |

Assign the highest satisfied level. These are severity levels, not sequential
recovery phases. Wilder RSI period 14 is an explicit assumption because the
screenshots do not show its period. No threshold or period was optimized.

The initial [protocol](protocol.md) was committed before v5 event outcomes were
calculated. The [archive extension protocol](archive-protocol.md) was committed
after inspecting that initial limited study, but before archive-based outcomes.
Neither is an untouched prospective test. The static macro, momentum, value and
price z-score studies from earlier rounds remain unchanged.

## Source validation and coverage

The user supplied an immutable CSV from
[maaurocp/Trading_Protocol](https://github.com/maaurocp/Trading_Protocol/blob/bf64e83fa4c2a6e72c37d3883476dc81bd9d2e31/data/raw/fred_BAMLH0A0HYM2.csv).
Only its data is used; repository code is not executed.

- Commit `bf64e83fa4c2a6e72c37d3883476dc81bd9d2e31`, 11 February 2026.
- Exact Git blob `fee6be14d5322d7402826f1ea2d03de5a475ac0d`.
- CSV SHA-256 `98c4ee48d97653d52835850e321b8a79d555c49dc9645736ace2a3df3ee998ea`.
- 7,693 sorted unique daily rows, 7,599 values and 94 explicit blanks,
  31 December 1996–6 February 2026; no forward filling.
- All **601** nonmissing overlapping observations match official FRED exactly,
  23 October 2023–6 February 2026. Maximum difference **0.00 percentage points**;
  no threshold crossings differ. Reference FRED snapshot: 21 October 2026.

Agreement supports the archive's historical values. It does not recover original
publication times or prove absence of earlier revisions. There are three separate
cohorts in `data/bottoming.json`:

1. `studies.archive`: full three-input rule with retrospective HY history before
   original-vintage coverage. **1,202 complete weeks**, 26 September 2003–16 October
   2026. Missing original-vintage values are not replaced with archive data.
2. `studies.full`: strict original FRED-vintage availability, **156 weeks**,
   27 October 2023–16 October 2026; too short for systemic-crisis inference.
3. `studies.two`: separate RSI/VIX ablation, **1,204 weeks** since September 2003.
   This is not the original three-input rule.

Modern VIX began on 22 September 2003; pre-launch reconstructed history is excluded.
S&P 500 index prices seed weekly RSI from 1970; SPY adjusted daily prices provide
tradable total-return outcomes from 1993. Old price and CBOE data are retrospective
histories. Raw market files remain private under `work/research-v5`.

## Entry timing and results

A setup is the first qualifying week after a known, consecutive nonqualifying
week. A left-censored or missing predecessor cannot create an entry. Each holding
horizon retains the first setup, then skips overlapping entries. Every skipped
and immature entry remains in the evidence file. Actual execution is the close
of the second SPY session after the week ends; the preceding calendar day is the
information cutoff. Weekly input dates must match the actual final index session.
No monthly substitution, interpolation or artificial zeros are used.

Primary horizon is 252 trading sessions (about 12 months); 21/63/126 sessions are
exploratory. Net results charge 10 bp at both entry and exit, with 25 bp per side
as a stress case. Adverse excursion is the worst daily adjusted close relative
to entry, including the entry day. It excludes intraday losses and is not a
portfolio maximum drawdown. Overlapping unconditional weekly references are
descriptive and cannot establish a causal advantage.

Archive cohort, primary 252-session horizon through 21 October 2026:

| Rule | Mature nonoverlapping entries | Mean net return | Positive | Worst adverse move |
|---|---:|---:|---:|---:|
| L1 or higher | 10 | +16.68% | 8/10 | −25.31% |
| L2 or higher | 7 | +21.48% | 6/7 | −42.74% |
| L3 only | 2 | +34.95% | 2/2 | −31.36% |
| RSI ≤40 only | 10 | +14.16% | 8/10 | −44.53% |
| VIX ≥25 only | 10 | +11.46% | 7/10 | −43.44% |
| HY ≥4.5% only | 7 | +15.23% | 6/7 | −25.31% |

These results are promising descriptive evidence for further investigation, with
few crises, related rules, retrospective revisions and a small effective sample.
They are not annualized strategy returns, probabilities or proof of incremental
predictive value. `confirmedEdge` remains false. In particular, L2 first triggered
in January 2008, far before the final bottom, and lost 36.8% at its one-year exit.
Showing the adverse path is essential to interpreting the average result.

Prior verified monthly macro state, momentum and SPY value/price z-scores are
attached to entries using only context cutoffs no later than the decision. They
are inspected as context, not used to fit a winner-selection filter.

## Live display and reproducibility

`GET /api/bottoming` obtains daily S&P 500 index prices and server-side FRED
VIXCLS/BAMLH0A0HYM2 observations. It classifies only a completed week. Missing
inputs produce explicit lower/upper possible levels; an exact level can sometimes
be determined from partial inputs, which still remain labelled incomplete.
A new level signal requires an increase between two complete consecutive weeks.
No alert is sent. Current values are dated refreshed inputs, not stored historical
forecasts. On failure the UI shows the separately dated verified research snapshot;
it does not present it as a successful live fetch. The tab and evidence work offline.

With Python requirements from v2 and the private server FRED key configured:

```sh
npm run research:v5
npm run research:v5:verify
npm run test:research:v5
npm test
```

Reproduce earlier v2/v3 feature bundles first (see their READMEs). `acquire.py`
fetches source data, `build.py` calculates the initial cohorts, `archive.py` validates
and adds the separate extended cohort, and `verify.mjs` independently reconstructs
all classifications, chronology, vintages, context, episodes, costs and outcomes
from raw files. Only a passing verifier atomically replaces the public evidence.
Keep source receipts to reproduce the exact archived run; re-downloaded histories
can change. The pinned archive must pass exact Git blob and overlap checks.

The published audit checked 1,204 RSI values, 2,408 classifications, 3,612 input
vintage/availability values, 1,016 event entries, 575 mature event outcomes and
76 study summaries. It also verified archive identity, all 601 overlap values,
and preservation of both initial studies. Browser verification covers desktop,
390px mobile, cohort/horizon/rule selection, dated episode context, API failure
and recovery, plus offline operation. Earlier research stays separate.
