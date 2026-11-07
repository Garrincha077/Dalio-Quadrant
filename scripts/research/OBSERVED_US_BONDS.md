# Observed US bond inputs and simple fixed rules

This user-authorised continuation stays in the United States. It improves IEF
inputs with dated issuer holdings, compares issuer NAV-reinvestment returns with
adjusted market closes, and tests three economically defined fixed entry masks.
Earlier fitted studies, prices and live economic preferences remain unchanged.

## Obtained sources and remaining access needs

The [IEF issuer page](https://www.ishares.com/us/products/239456/ishares-710-year-treasury-bond-etf)
documents 7–10Y US Treasury exposure and a July-2002 fund launch. Its public
product-data service supports historical holdings and monthly reinvestment
performance. The service URL and explicit request fields are retained in
fetch-ief-risk-history.py; no login or paid data source was used.

290 actual month-end requests produced 233 exact-date holdings snapshots, with
zero request failures. 57 requested dates returned another date, often the
current portfolio, and were rejected. Of the exact snapshots, one month,
2006-10, has inadequate bond risk fields. **232 monthly risk observations** pass
the gates, spanning 2006-09–2026-09 with gaps. Exact-date does not mean the original
publication timestamp has been independently captured: these are as-of
reconstructions retrieved now. A two-month input lag is an explicit publication-
buffer assumption, not proof of fully point-in-time holdings history.

The existing Alpha Vantage IEF adjusted market series remains primary, covering
2002-08–2026-09. The separate issuer sensitivity uses its monthly reinvestment
chart on the exact same months. Dummy pre-inception chart points are removed;
NAV prices alone are never treated as total returns. Over 289 monthly return
comparisons, median absolute market/NAV difference is 5.891698 bp, maximum
44.842462 bp. Premiums, reinvestment timing, distributions and chart rounding can
matter. Neither basis is selected for adoption using the measured rule returns.
Fund expenses are already embedded; only entry/exit costs are added.

Long observed US Treasury data are still an access need. The official
[CRSP description](https://www.crsp.org/research__trashed/crsp-us-treasury-database/)
lists monthly observations since 1925, daily observations since 1961, and prices,
interest, yields and duration. Its documentation was assessed; no licensed data
or price quotation was obtained. IEF's published ICE 7–10Y benchmark identifies a
relevant maturity universe, but a validated long benchmark history has not been
acquired. [S&P's 7–10Y Treasury index](https://www.spglobal.com/spdji/en/indices/fixed-income/sp-us-treasury-bond-7-10-year-index/)
identifies pre-March-2010 launch history as back-tested. It was not silently used
as observed contemporaneous history. No international dataset enters this study.

## Treasury-sleeve risk calculation

Each issuer response must identify fund 239456 and match the exact requested
date. Arrays for weight, asset class, CUSIP, yield and duration must align.
Include positive-weight fixed-income US Treasury securities with 912 CUSIPs.
Require eligible Treasury weight 95–105%, total reported net weight 95–105%, and
at least 99% of eligible Treasury weight with finite YTM and positive duration.
Weights normalize across that valid Treasury sleeve. Cash and nonbond positions
are excluded, not assigned fabricated risk. This is not an official whole-fund
SEC yield or exact fund effective duration.

The initial <=101% sleeve bound was repaired BEFORE new rule returns were
calculated: small negative cash/settlement balances can make positive Treasury
weights exceed 101% while net reported fund weights remain 100%. The replacement
105% bound and original coverage floor remain disclosed in the protocol. The
source-accounting clarification did not select a more profitable threshold.

Annual carry cushion in percentage points = sleeve YTM (%) / duration (years).
For example, 4% / 8 years = 0.5 percentage point, or 50 bp of parallel yield rise
offsetting one year's carry in a first-order approximation. It is not a return
forecast; curve roll, convexity, changing holdings, cash, expenses and execution
matter. The entry signal uses holdings from month t−2.

## Three rules, no fitted return coefficients

1. Cushion exceeds the median of the prior 60 months, excluding the tested
   cushion (reference t−62…t−3, tested risk t−2).
2. Rule 1 plus three-month headline PCE YoY change below −0.20 pp.
3. Rule 2 plus CFNAI-MA3 below zero.

Macro reference is t−2, with the same exact paired months/PCE base and numerical
tolerance 1e-9 as the earlier method. Revised and actual archived macro inputs
stay separate. Archived macro does not repair the holdings publication-timestamp
limitation. No entry-score fitting, candidate selection or threshold optimisation.

PRIMARY reference mode requires all 60 consecutive risk observations. Archive
gaps remove many possible windows. A separately disclosed pre-outcome source-
availability sensitivity requires >=48 OBSERVED observations in that same prior
60-calendar-month window, no missing run over six months, and a window beginning
no earlier than the first valid source month. No observation is interpolated,
and the current lagged risk must always exist. Both modes are retained; do not
select the better one on outer returns.

At 12M / archived macro, the strict mode has 57 scored starts, while the observed-
history sensitivity has 157. Every rule within a mode/basis/information set uses
the same eligible rows. Market and NAV sensitivity use identical dates and masks.
The coverage difference is part of the finding, not a hidden sample substitution.

## Returns, temporal checks and inference

Outcomes are cumulative nominal USD at 3/12/36M, net of 10 bp per entry/exit side,
with 25 bp stress. Selected means are compared with the SAME asset's mean on ALL
eligible rows. Show downside, losses, episodes, non-overlapping holdings and
paired gains of rule 2 versus 1 and rule 3 versus 2. Empty selections are
unavailable, not a zero-return strategy.

5,000 paired circular calendar-block draws, max(12,h) months, preserve gaps and
both selection masks; >=80% valid draws are required. Interpretation gate is
24 starts/six episodes, for both masks in paired inference. Holm pools supported
rules, paired gains, horizons, BOTH reference modes and BOTH return bases within
each macro information set. Intervals remain unadjusted. Episode splits can
reflect missing observations and are not independent economic cycles.

All fixed entry-date segments are shown: through 2015, 2016–2019 and 2020–2026,
each with its own eligible usual baseline. These dates were researched previously;
they are not untouched holdouts. No segment selects a rule, and no separate
segment significance is claimed. These are conditional entry comparisons, not
portfolio CAGR, cash-waiting returns or prospective alpha.

For 12M records only, a clearly separate EX-POST diagnostic uses entry/exit-month
observed sleeve yields: approximation = starting YTM/100 − starting duration ×
change in YTM/100. Future yields never enter a signal, mask or input reference.
The actual comparison is before the added trading cost; embedded fund expenses
remain. Rebalancing, cash, roll, convexity and price/NAV effects leave a residual.
It is approximate explanation, not exact attribution or an ex-ante prediction.

## Reproduction, exports and verification

Private inputs stay under ignored work/research/ief-risk/. The collector records
every exact hash, unavailable returned date and request failure, and rejects
non-JSON pages even when HTTP succeeds. Prepare previous IEF prices and macro
archives as in the earlier methods, then:

```sh
work/research/.venv/bin/python scripts/research/fetch-ief-risk-history.py
OPENBLAS_NUM_THREADS=1 work/research/.venv/bin/python scripts/research/observed_us_bonds.py
work/research/.venv/bin/python scripts/research/test_observed_us_bonds.py
node scripts/research/verify-observed-us-bonds.mjs
npm test
```

Outputs data/observed-us-bonds.json and .csv retain all 24 information/reference/
basis/horizon experiments, quality gates and amendment, derived monthly sleeve
risk, 2,452 eligible rows across experiments and 7,356 fixed-rule decisions.
These counts overlap and do not represent independent cycles. Raw positions,
fund/NAV price levels and licence-restricted long histories are not published.

Independent Node verification reconstructs all 232 valid risk observations from
raw security fields and hashes, every reference median and eligibility decision,
exact macro source inputs, costs, returns, fixed masks, temporal means, paired
gains and ex-post approximations. No Python helpers are imported. Eleven new
Python tests cover ignored as-of dates, alignment, cash accounting, risk gaps,
reference timing, nested masks, costs and future-diagnostic separation. Node
tests reconcile CSV decisions and prove the NAV basis cannot alter entry masks.

127 Node and 94 Python tests pass. Chromium covers all 72 new control combinations,
primary/sensitivity labels, diagnostics, downloads, deferred loading, source-
failure isolation and earlier cards, with no page errors or horizontal page
overflow at 320/360/390/1440 pixels. Live FRED is not configured locally; static
research remains usable independently.

[Findings](OBSERVED_US_BONDS_FINDINGS.md) · [Protocol and pre-outcome clarifications](observed-us-bonds-protocol.md)
· [Long-history input contract](US_TREASURY_INPUT_CONTRACT.md).
