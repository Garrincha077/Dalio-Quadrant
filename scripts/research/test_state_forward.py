import unittest
import numpy as np
import pandas as pd
from state_forward import classify, forward_return, bootstrap_lifts, summarise


class StateForwardTests(unittest.TestCase):
    def test_classification_uses_economic_anchors(self):
        self.assertEqual(classify(0.01, 3.4), "above-above")
        self.assertEqual(classify(-0.1, 1.5), "below-below")
        self.assertEqual(classify(0, 3), "boundary")
        self.assertEqual(classify(0.2, 2), "boundary")
        self.assertIsNone(classify(np.nan, 3))

    def test_cumulative_compounding_and_delayed_entry(self):
        p = pd.Series(
            [100, 110, 121, 133.1, 200, 300],
            index=pd.period_range("2020-01", periods=6, freq="M"),
        )
        self.assertAlmostEqual(forward_return(p, p.index[0], 3), 0.331)
        self.assertAlmostEqual(forward_return(p, p.index[0], 3, 2), 300 / 121 - 1)

    def test_immature_or_missing_prices_are_not_zero(self):
        p = pd.Series(
            [100, 100, 100, 100], index=pd.period_range("2020-01", periods=4, freq="M")
        )
        self.assertEqual(forward_return(p, p.index[0], 3), 0)
        self.assertIsNone(forward_return(p, p.index[1], 3))
        self.assertIsNone(forward_return(p.drop(p.index[1]), p.index[0], 3))
        self.assertIsNone(forward_return(p, p.index[0] - 1, 3))

    def test_baseline_includes_boundary_and_episode_gaps(self):
        frame = pd.DataFrame(
            {
                "quadrant": ["below-below", "boundary", "below-below", "above-above"],
                "activity": [-1, 0, -2, 1],
                "inflationGap": [-1, 1, -1, 1],
                "return": [0, 0.2, 0.4, np.nan],
            },
            index=pd.period_range("2020-01", periods=4, freq="M"),
        )
        r = summarise(frame, 3)
        self.assertEqual(r["n"], 3)
        self.assertAlmostEqual(r["mean"], 0.2)
        self.assertEqual(r["cells"]["below-below"]["episodes"], 2)
        self.assertEqual(r["cells"]["above-above"]["n"], 0)
        self.assertEqual(r["cells"]["below-below"]["positive"], 0.5)

    def test_bootstrap_keeps_categorical_pairs_and_is_reproducible(self):
        values = np.zeros(100)
        categories = np.array(["below-below"] * 50 + ["above-above"] * 50)
        first = bootstrap_lifts(values, categories, 36, draws=100)
        self.assertEqual(first, bootstrap_lifts(values, categories, 36, draws=100))
        self.assertEqual(first["below-below"]["interval"], [0, 0])
        self.assertIsNone(first["boundary"]["interval"])

    def test_categorical_eta_and_continuous_correlations(self):
        frame = pd.DataFrame(
            {
                "quadrant": ["below-below"] * 3 + ["above-above"] * 3,
                "activity": [-3, -2, -1, 1, 2, 3],
                "inflationGap": [-3, -2, -1, 1, 2, 3],
                "return": [0, 0, 0, 0.1, 0.1, 0.1],
            },
            index=pd.period_range("2020-01", periods=6, freq="M"),
        )
        r = summarise(frame, 12)
        self.assertAlmostEqual(r["etaSquared"], 1)
        self.assertAlmostEqual(r["cells"]["above-above"]["correlation"], 1)

    def test_longer_blocks_preserve_longer_category_runs(self):
        categories = np.array((["above-above"] * 50 + ["below-below"] * 50) * 6)
        values = np.where(categories == "above-above", 0.1, 0)
        short = bootstrap_lifts(values, categories, 3, draws=1000)["above-above"][
            "interval"
        ]
        long = bootstrap_lifts(values, categories, 36, draws=1000)["above-above"][
            "interval"
        ]
        self.assertGreater(long[1] - long[0], short[1] - short[0])


if __name__ == "__main__":
    unittest.main()
