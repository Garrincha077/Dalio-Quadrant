# Contract for a future long US Treasury history

This is a concrete intake/validation specification, not a claim that a licensed
long series has been acquired. Current scope is United States only.

Required monthly index/fund columns:

| Field | Definition |
| --- | --- |
| series_id | Stable index/fund identifier; separate portfolios stay separate |
| date | Actual valuation/trading date, with timezone/calendar documented |
| currency | USD |
| total_return_index OR monthly_total_return | Positive cumulative total-return level, or decimal return including coupon reinvestment; convention documented |
| yield_to_maturity_percent | Beginning portfolio YTM in percent/year, not a realised forward return |
| duration_years | Dated portfolio duration, with effective/modified convention fixed and named |
| maturity_bucket | Documented eligible remaining maturity or target-maturity rule |
| source_as_of_date | Economic date represented by each input |
| publication_date | First availability timestamp if original point-in-time use is claimed |
| source_version / retrieved_at | Revision/retrieval provenance |
| launch_date / backtest_flag | Distinguish contemporaneously calculated index history from pre-launch reconstruction |

Require a source manifest naming the publisher, currency, maturity universe,
weighting/rebalancing, coupon reinvestment, accrued-interest convention, expenses,
source files and hashes, and permitted use. Preserve raw licensed files privately;
do not redistribute them without the applicable permission.

Security-level alternatives need stable bond IDs, prices (clean/dirty labelled),
accrued interest, coupon schedules, maturity, amount outstanding, actual redemption
events and dated risk measures or a documented cash-flow pricing method. Data on
surviving bonds alone is insufficient for a historical portfolio.

Validation gates:

1. Unique dates, positive levels, complete monthly intervals within declared
   coverage, no future-dated or missing fields disguised by filling.
2. Reconcile provided returns with index-level ratios, reinvestment and expenses;
   distinguish net fund returns from gross index returns.
3. Match IEF's 7–10Y exposure or publish the different duration/maturity universe
   separately. Never splice a broad Treasury index onto IEF silently.
4. Verify input dates precede the decision cutoff; late publications/revisions
   remain labelled. No present-day duration is backfilled into old months.
5. Compare overlaps against independently obtained fund/index data and retain
   the discrepancies, rather than choosing the more attractive source.

The current issuer study already supplies dated IEF Treasury-sleeve YTM/duration
and fund return checks, with explicit archive gaps. It does not satisfy an
observed long-history index requirement or independently verified original
publication timestamps for holdings.

[Current issuer study](OBSERVED_US_BONDS.md) · [Data priorities](DATA_UPGRADE_PLAN.md).
