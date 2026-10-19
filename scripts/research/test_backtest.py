"""Synthetic checks run without private price caches or network access."""

import unittest
import numpy as np
import pandas as pd
import backtest as b


class BacktestTests(unittest.TestCase):
    def test_switching_cost_and_drift(self):
        weights = np.array([[0, 0.6, 0.4], [0, 0.6, 0.4], [1, 0, 0]])
        returns = np.array([[0, 0.1, -0.1], [0, 0, 0], [0.001, 0, 0]])
        ret, cost, turn = b.net_returns(weights, returns)
        self.assertAlmostEqual(cost[0], 0.001)
        self.assertAlmostEqual(
            cost[1], abs(0.6 - 0.66 / 1.02) * 0.001 + abs(0.4 - 0.36 / 1.02) * 0.001
        )
        self.assertAlmostEqual(cost[2], 0.001)
        self.assertAlmostEqual(ret[0], 0.019)
        self.assertAlmostEqual(turn[0], 1.0)

    def test_cash_has_no_artificial_entry_cost(self):
        ret, cost, turn = b.net_returns([[1, 0], [1, 0]], [[0.001, 0], [0.002, 0]])
        np.testing.assert_allclose(cost, [0, 0])
        np.testing.assert_allclose(turn, [0, 0])

    def test_drawdown_and_compounding(self):
        m = b.metrics([0.1, -0.2, 0.25], [0, 0, 0])
        self.assertAlmostEqual(m["totalReturn"], 0.1)
        self.assertAlmostEqual(m["maxDrawdown"], -0.2)
        self.assertAlmostEqual(m["cagr"], 1.1**4 - 1)

    def test_train_labels_mature_before_decision(self):
        f = pd.DataFrame(
            {
                "cutoff": pd.to_datetime(["2020-01-30", "2020-02-27", "2020-03-30"]),
                "target_end": pd.to_datetime(
                    ["2020-02-28", "2020-03-31", "2020-04-30"]
                ),
                "ret_SPY": [0.1, 0.2, 0.3],
            }
        )
        self.assertEqual(b.train_indices(f, 1, ["ret_SPY"]).tolist(), [])
        self.assertEqual(b.train_indices(f, 2, ["ret_SPY"]).tolist(), [0])

    def test_future_labels_cannot_change_past_forecasts(self):
        n = 90
        rng = np.random.default_rng(4)
        dates = pd.date_range("2000-01-31", periods=n, freq="ME")
        f = pd.DataFrame(
            {
                "tradeDate": dates,
                "cutoff": dates - pd.Timedelta(days=1),
                "target_end": dates + pd.offsets.MonthEnd(1),
                "ret_SPY": rng.normal(0.005, 0.04, n),
                "ret_CASH": np.full(n, 0.001),
            }
        )
        for col in b.MACRO:
            f[col] = rng.normal(size=n)
        first, _ = b.forecasts(f, "macro", 100, ["SPY"])
        f.loc[75:, "ret_SPY"] = 999
        second, _ = b.forecasts(f, "macro", 100, ["SPY"])
        np.testing.assert_allclose(first[:77], second[:77], equal_nan=True)

    def test_ridge_handles_training_missingness_and_constant_columns(self):
        x = [[1, np.nan], [1, 2], [1, 2], [1, 2]]
        result = b.ridge_predict(
            x, np.array([[0.1], [0.1], [0.1], [0.1]]), [[1, np.nan]], 100
        )
        self.assertAlmostEqual(result[0, 0], 0.1)

    def test_bootstrap_does_not_confirm_zero_advantage(self):
        result = b.bootstrap_advantage(np.zeros(60), np.zeros(60))
        self.assertFalse(result["confirmedPositive"])
        self.assertEqual(result["lower95"], 0)


if __name__ == "__main__":
    unittest.main()
