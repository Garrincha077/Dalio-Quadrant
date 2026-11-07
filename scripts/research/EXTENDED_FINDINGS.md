# Extended research findings · 26 October 2026

The longer public-proxy history does **not** support a reliable advantage from
this particular state + trend allocation rule. Keep the economic dashboard as a
descriptive tool; these results do not validate its live asset rankings as a
profitable strategy. The newer ETF period looks better relative to the matched
unconditional selector, but its uncertainty still includes zero.

## Actual evaluated periods

- Long panel: inputs January 1973–May 2025, decisions January 1980–April 2025,
  portfolio returns February 1980–May 2025, **544 months**. Initial 1973–1979 data
  supports learning; no fictitious trading profit is attributed to that warm-up.
- ETF panel: inputs March 2006–September 2026, decisions January 2013–August 2026,
  portfolio returns February 2013–September 2026, **164 months**.
- Economic descriptive history: May 1967–August 2026, **712 revised states**.

All results below are nominal USD and use 10 bp per risky buy/sell side, zero
leverage and the specified initial 12-sleeve ramp. Long gold has no custody fee
in the base case. Maximum losses are measured at monthly observations.

| Policy | Long proxy CAGR | Long monthly max drawdown | ETF CAGR |
| --- | ---: | ---: | ---: |
| State + trend / annual sleeves | 5.47% | −44.74% | 12.35% |
| Unconditional selection / annual sleeves | 6.59% | −54.19% | 10.20% |
| Equal-weight basket / ramped | 7.48% | −22.76% | 5.89% |
| US equities / ramped | 11.78% | −50.31% | 13.71% |

The equity and equal-weight controls have different exposures from the adaptive
selector. The unconditional selector is the primary matched comparison.
Long and ETF panels have different instruments and periods; their CAGRs are not
a controlled before/after comparison. Historical outperformance of equities is
not an instruction to choose that asset after seeing the table.

## Uncertainty in the primary comparison

Annualised paired arithmetic mean difference, state+trend minus unconditional:

| Panel | Difference | Paired 95% interval / 12M blocks |
| --- | ---: | ---: |
| Long public proxies | −1.47 pp | −5.15 to +2.00 pp |
| Actual ETFs, revised macro | +1.92 pp | −2.99 to +7.59 pp |

Both intervals contain zero. Using 24-month blocks also includes zero: long
−5.89 to +2.59 pp; ETF −1.93 to +7.04 pp. These retrospective bootstrap intervals
are neither forecast intervals nor a correction for all researcher selection.

## Transaction and carrying costs

| Cost per risky side | Long state+trend CAGR | ETF state+trend CAGR |
| --- | ---: | ---: |
| 10 bp | 5.47% | 12.35% |
| 25 bp | 5.32% | 12.27% |
| 50 bp | 5.05% | 12.13% |

Separate long gold custody sensitivities, still at 10 bp transaction costs:

| Annual gold carrying cost | State+trend CAGR | Unconditional CAGR | Equal-weight CAGR |
| --- | ---: | ---: | ---: |
| 0% | 5.47% | 6.59% | 7.48% |
| 0.25% | 5.55% | 6.90% | 7.41% |
| 0.50% | 5.48% | 6.94% | 7.34% |

Carrying costs alter historical training returns and therefore the selected
assets; they are not simply subtracted from a fixed allocation's CAGR. This
explains why adaptive selectors need not decrease monotonically across these
cost assumptions. None of the assumptions is chosen because it improves the
result. The primary paired advantage remains unconfirmed in every case.

## Coverage limits and next evidence

The 1973–2026 target is only partly covered. AQR's downloaded commodity series
ends May 2025; there is no splice to a different commodity index for the rest.
The long panel uses broad US equities, reconstructed bonds and monthly average
gold, so it cannot establish an executable pre-ETF strategy. CFNAI was not publicly
available before March 2001. Both published simulations use revised states with
a fixed two-month delay, which does not eliminate revision bias.

A stricter test needs dated macro vintages and verified month-end total-return
indices, with appropriate cash data. The code's vintage path is guarded and is
not represented as an already executed result. The original momentum experiment
and current live preference card were not retuned from these findings.

See [methodology, sources and reproduction](EXTENDED_STATE.md). Numerical evidence
is in `data/extended-long-state.json` and `data/extended-state.json`; the independent
Node audit reconciled **2,124** policy-month decisions, net returns and costs
against private input data. Synthetic checks cover label maturity, future-data
invariance, missing states, source guards and self-financing sleeve execution.
