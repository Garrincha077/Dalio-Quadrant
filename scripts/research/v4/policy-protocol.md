# Portfolio-utility selection extension

Declared 22 October 2026 after the 84 ranking and 36 risk configurations were
inspected. Neither established incremental macro value. This final extension
tests the user's economic objective directly: choose among the already declared
ranking configurations using earlier net portfolio performance rather than
earlier rank IC. No new return predictor or hyperparameter is fitted or searched.

For each ranking cohort/horizon, use the same six settings per family, exact
already-fitted causal return predictions, bounded inverse-vol rank-tilt policy,
10% past-risk cap and10/25bp costs. Reconstruct every candidate's continuous
monthly policy from its earliest common forecast, including later cash fallback.
Its earlier holding returns may be used for model selection only if the actual
execution at the interval end was on or before the current information cutoff.
Thus the current decision-month return and all later outcomes are excluded.

Each selector chooses using the latest36 eligible known holding months with a
minimum24, maximising annualised excess Sharpe after10bp costs. Selection is
within each family and adaptively across all families, with the same declared
tie order. Missing returns remain in the calendar and can withhold evaluation;
cash fallback is a realised return, not a deleted case. Prior candidate returns
are their standalone policy returns, not a fictional history of the selected
strategy. The selected strategy is then evaluated from its own drifted holdings,
charging all actual model-switch turnover. No winner chosen by the eventual
full-history Sharpe is substituted for this procedure.

This adds18 selector procedures (4 main +5 value, at each of H=12 and H=3) to
the120 previously declared predictor configurations. It does not turn those18
procedures into new independent experiments or increase the number of assets.
Publish all18, with matched historical-mean, inverse-vol, SPY, 60/40 and equal-five
references. The earlier IC-selected results remain separate and unchanged,
apart from the more conservative cumulative comparison correction below.

Four policy-primary pairs at12M: adaptive and interactions versus selected market
in each cohort. Rank-IC and3M diagnostics are exploratory. Pairwise net-policy
Sharpe block tests use the existing2,500 circular12-month draws/seed20261022.
Holm now covers ten policy-primary tests: the previous four ranking-policy and
two risk-policy tests plus these four. The six prediction-primary tests are
unchanged; no new prediction-significance claim is introduced by this extension.

Report net CAGR, risk, drawdown, turnover and stress costs, all fixed calendar
folds and full selection paths. A useful retrospective economic candidate must
improve net CAGR at no more than110% realised volatility and no worse drawdown,
against BOTH the selected market model and the matched historical-mean policy.
Stronger evidence additionally requires a positive lower95% paired Sharpe
interval, Holm p<.05, and a positive annual mean excess-return difference in
every populated fixed fold. No confirmed-edge status; all histories were already
exposed before this extension and new future observations remain necessary.
