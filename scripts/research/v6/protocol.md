# Recovery confirmation and investable bottoming strategies — round 6

Declared 22 October 2026, after all v1–v5 results were inspected and before any
v6 strategy outcome. User authorizes continued research. This is retrospective
research on already inspected history, not a fresh holdout or an assurance of
success. Preserve every earlier artifact, source receipt and protocol unchanged.
No RSI, severity threshold, recovery window or fold is optimized in this round.

## Purpose and success criteria

Test whether recovery confirmation after the user's L2+ stress signal improves
an executable SPY/cash policy, including the cost of waiting. Compare against
immediate L2 entry, risk-capped passive SPY and a simple 40-week price trend.
Distinguish net-return improvement from a useful defensive tradeoff. Long-run
price z, fundamental value z and macro momentum have separate ablations.

An economic-return candidate must have higher net CAGR, realized weekly
volatility no greater than110% of the comparator, and no worse daily-close
portfolio maximum drawdown, versus ALL three references: corresponding immediate
policy, trend-only and passive risk-capped SPY. A defensive candidate must have
CAGR no more than0.5 percentage points below each reference, at least20% less
absolute drawdown, higher excess Sharpe and no greater than110% volatility.
Stronger retrospective support additionally requires positive lower95% paired
Sharpe intervals and Holm p<.05 for every relevant primary pair, and positive
annualized mean excess-return gains against the corresponding immediate policy
in every populated fixed calendar fold. No confirmed-edge label is allowed;
prospective data would still be needed. Report every failure and configuration.

## Frozen sources and decision calendar

Use v5's independently verified archive cohort, its exact daily S&P500 and SPY
histories and original-vintage precedence. Modern VIX start remains September
2003. Older HY/CBOE values are retrospective reconstructions. No new sources or
revisions are silently substituted. Hash-check public v5 and raw source files.

Weekly decisions use the same completed Friday week, actual final index session,
second subsequent SPY-session execution close and preceding-calendar-day cutoff.
The last policy interval ends at the next verified execution, 20 October2026;
an unfinished last interval is excluded from strategy outcomes. Earlier weekly
inputs used for a four-week change are their already known readings, not
future-revised reconstructions. Publish their dates and sources. Full-three-input
eligibility is required to arm a stress setup.

Risk estimate: sample standard deviation of the last52 completed weekly SPY
adjusted-close returns ending at the decision week, annualized by sqrt(52).
Risky target when on = min(1,0.10/pastVolatility); no leverage. S&P500 raw index
closes define10- and40-week simple means including the just-completed week;
publish relative gaps rather than redistributing raw prices. All risk and trend
inputs precede execution. No future/incomplete week enters these estimates.

Cash carry uses the last verified v2 original-vintage monthly TB3MS cashYield
whose cutoff is no later than the weekly decision cutoff, at most62 calendar
days old. Apply (1+yield/100)^(elapsedCalendarDays/365)-1. TB3MS is a discount-
yield proxy and this effective carry is an approximation, not a quoted fund
return. Missing required cash or market history withholds the whole study rather
than removing losing weeks or assuming zero. Macro/value context cutoffs are
also no later than the weekly decision; treat input age>62 days as unavailable.

## Setups and seven fixed entry rules

A setup is the v5 false-to-true L2+ episode with a known complete predecessor in
the immediately preceding week. The first positive and positives after missing
weeks are left-censored. A pending setup may confirm in its first26 weekly
steps, including the setup week and week+26; it expires at week+27. Further
setups while pending are retained as merged records and never extend its expiry.
Confirmation and expiration are computed without reference to future returns.
All setup, merged, confirmed, expired and still pending records are published.

1. `immediate`: enter at the initial L2+ setup.
2. `stress`: after setup, VIX and HY are both strictly below their readings four
   completed weeks earlier. Require all four actual readings and consecutive weeks.
3. `recovery`: stress confirmation AND S&P500 weekly close above its10-week SMA.
4. `price`: price above10-week SMA after setup, without VIX/HY momentum confirmation.
5. `price-z`: recovery AND last available v3 SPY price z<=0. Price z is a completed-
   month10-year log-price score, not a valuation measure or buying probability.
6. `macro`: recovery AND last verified growth momentum>0 AND inflation momentum<0.
7. `value`: recovery AND last verified SPY value z>=0 (relatively cheaper earnings-
   yield proxy). This sign differs intentionally from the price z sign.

No filter is substituted for a missing input. Entries can occur on a later week
within the same fixed waiting window; missed and delayed recoveries are retained.
A confirmation is a candidate signal, not proof the final low occurred.

## Two actual portfolio uses and three cohorts

Each rule has two policy uses, both long/cash, weekly rebalanced:
- `event`: cash until a confirmation, then risky target for52 weekly holding
  intervals (about12 months). Further confirmations during an existing52-week
  event position are logged and ignored; they never reset its timer.
- `overlay`: same52-week event timer, but the core holds the risky target whenever
  index price is above its40-week SMA. An active event position may override an
  off core. No other exit or ex-post stop is added.

References are weekly risk-capped passive SPY, the same40-week trend-only rule,
and cash. All share each cohort's continuous holding calendar and all fees.
The original v5 252-session fixed-entry event study is preserved; the new52-week
continuous policy is separately labelled and may enter on different dates.

Three inception cohorts are source-defined, before outcome inspection:
- `main`: v5 inception2003; immediate/stress/recovery/price plus references.
- `price`: first weekly cutoff with an available completed-month SPY price z;
  adds price-z, without requiring macro/value availability.
- `context`: first weekly cutoff where price z, value z and both macro momenta
  are available; adds macro/value as well. Later missing filter values withhold
  the affected entry but never delete holding intervals or existing positions.

Thus11 main,13 price and17 context paths =41 procedures, including references.
No best-by-full-history policy is substituted for a declared procedure.

## Costs, outcomes and diagnostics

Start each policy entirely in cash. Rebalance to post-fee target weights using
actual drifted risky holdings; solve self-financing trade notional with10bp cost
per risky buy/sell leg, and independently25bp stress. Charge final liquidation
on20 October2026. Earn cash carry on idle cash. No margin, borrowing or shorting.
For wealth1, incoming risky fraction b, desired post-fee fraction w, fee c:
trade=(w-b)/(1+c*w) for buys, (b-w)/(1-c*w) for sells; fee=c*trade.
Post-trade capital=1-fee; hold fraction w in SPY until next weekly execution.

Report net CAGR on actual elapsed days (365.25/year), weekly realized volatility,
weekly excess Sharpe, actual average risky exposure, turnover, final wealth,
25bp-cost CAGR, all executions and expiry/ignored signals. Maximum drawdown is
from daily adjusted-close portfolio marks, including entry/rebalance/final fees,
not a weekly-only or individual-trade adverse excursion. Daily cash accumulates
on actual elapsed days at the known decision's yield. Initial wealth1 is a peak.

Fixed diagnostics: through2010,2011–2019,2020–2022,2023onward; and results with
each populated fixed block omitted. Report how many distinct stress setups
support a result;52 weekly holdings do not create52 independent crises.

Six primary paired Sharpe comparisons in MAIN OVERLAY use stress and recovery,
each versus immediate overlay, trend-only and passive risk-capped SPY. Circular
52-week block bootstrap,2,500 replications, seed20261022. Recompute both Sharpes
on each paired draw using the same drawn cash. Centered two-sided bootstrap p,
95% percentile interval and Holm over the six declared tests. Price-only, event,
context, economic gates and block omissions are exploratory diagnostics; the
many earlier rounds are disclosed and this correction does not erase them.

## Publication and verification

Commit this protocol before outcomes. Save source/feature hashes, exact signals,
complete shared calendar, all41 policy paths and six comparison results. An
independent JavaScript implementation must reconstruct the raw-source inputs,
weekly indicators, setup state machine, every risk/cash/position/fee decision,
daily drawdowns, summaries, fixed blocks and bootstrap results before atomically
publishing a new separate artifact. Keep raw prices, private yields and credentials
out of browser bundles. Add focused causality/fee/gap/expiry tests, then verify
all new controls on desktop/mobile, partial/offline failure and recovery.
