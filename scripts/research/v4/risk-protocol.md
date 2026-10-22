# Risk-forecast extension — declared after ranking round 4

Declared 22 October 2026 after inspecting all 84 ranking attempts. That round
did not establish incremental 12M ranking value. Some 3M allocation differences
were positive but uncertain. Risk forecasting was already a secondary product
goal; this extension does not replace or relabel the ranking result.

Question: do original-vintage macro state changes improve forecasts of the
next three months' realised asset risk beyond past market risk? Twelve months
is exploratory for this risk question. All history remains already-exposed
retrospective research, with causal inner/outer timing, not an untouched test.

Use the same five assets, source cutoff, complete calendar, common main cohort,
cash excess returns and 36-prior-month minimum. Market risk inputs add preceding
3- and 12-month annualised excess-return root-mean-squares to the four market
inputs of the ranking experiment. All must end at t-1; the cash return for each
past month is the accrued original-vintage cash rate for that historical interval.
Macro and interaction families use exactly the existing four macro inputs and
five interactions. No value/price family in this extension.

Target is the annualised future second moment: 12/H times the sum of squared
monthly asset excess returns over the exact H-month future calendar. This is a
monthly-return risk proxy, not intramonth volatility or maximum drawdown.
Predict log(target / prior36Vol²) using the same asset-specific ridge settings:
lambda {100,1000,10}, expanding or last120, at least60 mature eligible starts.
Convert forecast back to variance by prior36Vol²×exp(prediction). No hindsight
bias correction or target tuning. Report variance QLIKE = actual/predicted +
log(predicted), averaged across all five assets for each month. Lower is better.

Fit 18 configurations at H=3 and H=12: 36 further attempts, bringing the complete
research ledger to 120. Family selectors and an adaptive all-family selector
use up to the last60 genuinely earlier out-of-sample forecasts with already
mature outcomes, requiring24 starts. Select the lowest mean QLIKE with the same
fixed candidate tie order. Record the chosen configuration. Never select on
unmatured labels, full-sample P&L or the current observation.

Portfolio: inverse predicted-volatility allocation, retaining the preceding
36-month correlation matrix. For allocation only, bound predicted volatility to
0.5–2 times the known prior36 volatility, then scale the total long-only risky
portfolio to at most10% predicted annual volatility, no leverage. Both selected
market and macro models use this identical rule. Missing post-inception signals
use cash. The pure past36 inverse-volatility portfolio, SPY, 60/40 and equal-five
under the original past-risk cap remain references. Same10bp costs/25bp stress.

Two risk-primary pairs at H=3: selected adaptive and selected interactions,
each versus selected market. Use 2,500 circular12-month-block resamples, seed
20261022. Keep missing calendar months. Measure paired QLIKE improvement
(market minus macro, positive is better) and paired net-policy Sharpe differences.
Holm families now include the four earlier 12M ranking tests plus these two risk
tests (six prediction tests and six separately corrected policy tests). This
controls this round's additional claim opportunities rather than hiding them.

Economic gates stay higher net CAGR, realised volatility no more than110% of
selected market, and no worse monthly maximum drawdown. Publish populated fixed
folds, all candidates and all references. Stronger retrospective evidence also
requires positive lower95% intervals, Holm p<.05 for both prediction improvement
and policy Sharpe, and positive risk-forecast improvement in every populated fold.
Any improvement discovered only here is explicitly a risk result, not proof that
macro improves 12M asset-return ranking. No confirmed-edge status is emitted.

Keep this protocol and its hash separate from the pre-results ranking protocol.
Verify features, target timing, model selection, predictions, portfolio weights,
costs and evidence independently before publishing either study.
