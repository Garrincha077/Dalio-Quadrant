# Predeclared research protocol — 19 October 2026

User requests preserved: number circles; fill left panel with conditional preferred
assets; historical economic audit; backtest S&P 500 and asset classes; test an
honest predictive overlay alongside the descriptive chart.

Data: Alpha Vantage monthly adjusted SPY/IEF/GLD/TIP/DBC (cached privately,
complete through Sep 2026). FRED/ALFRED real-time vintage snapshots at the calendar
day before each last trading day, to model actual macro publication/revision
availability. Source prices remain ignored under work/, not in public artifacts.
Try Yahoo daily SPY for market features known by that cutoff; if unavailable,
use prior-month monthly observations explicitly, never same-close predictors.

Evaluation: monthly forward one-month adjusted ETF returns in USD; cash is an
explicit T-bill-yield accrual proxy; 10 bp one-way switching cost and 25 bp stress.
Training labels must have matured before the signal cutoff, including a one-row
purge. No random train/test splits. Minimum 60 training observations. Expanding
walk-forward development with labels through Nov 2020 (December 2020 embargo so model selection precedes the first Jan 2021 holding); reserve Jan 2021–Dec 2025 as final
holdout. Select model family/hyperparameters using development only, then freeze
them before reporting final holdout. Refit coefficients on prior data only.

Compare buy/hold SPY, 60/40 SPY/IEF, equal-weight asset basket, simple market trend,
original quadrant allocation, training-only calibrated quadrants, and small ridge
predictors (macro-only, market-only, combined). Limited regularization choices
1/10/100; quadrant scale factors .75/1/1.25 and transition .10/.15/.20. Shrink
conditional asset means toward training global means, min 12 cases per cell.
No search for a winner on final holdout or retuning after seeing it.

Report CAGR, excess Sharpe, volatility, maximum drawdown, turnover, exposure,
sample sizes, forward return distributions and lag relationships. Use a paired
12-month block bootstrap for uncertainty; explicitly note small samples/multiple
comparisons. A predictive edge is unconfirmed if holdout evidence is weak.
Do not promise every quadrant's supposed asset wins, and never tune labels to
force historical narratives. Keep descriptive axes separate from predictions.

Observed economic audit already found: 2020-09 has GDP YoY -1.365% yet old label
Overheating (growth momentum +1, inflation +.476); 2022-06 has core PCE 5.299%
yet inflation momentum -.015. Replace level-claiming names with neutral momentum
directions; preserve underlying score formula/model compatibility.

Status: no source edits yet in this turn. Previous code clean at commit
60f480b463684fd003844f8df802a9292d2cc5ff, branch codex/fred-principles-monitor,
draft PR #4. Production unmodified. Full objective includes all UI and research
work above. Raw CSVs exist under work/research/prices/; source macros in ignored
work/snapshot.json. API key remains ignored in .env.local; never print it.

