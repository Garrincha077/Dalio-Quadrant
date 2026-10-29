"""Causal and economic invariants; no private inputs or network required."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result
f = module("value_features", HERE / "features.py")
b = module("value_backtest", HERE / "backtest.py")
a = module("value_acquire", HERE / "acquire.py")


class Scores(unittest.TestCase):
    def history(self, n=130):
        return pd.Series(np.linspace(1, 4, n), index=pd.period_range("2000-01", periods=n, freq="M"))

    def test_reference_excludes_current_and_has_a_calendar_window(self):
        s = self.history()
        score = f.score(s, "2010-11-29")
        reference = s.iloc[-121:-1]
        self.assertEqual(score["n"], 120)
        self.assertAlmostEqual(score["mean"], reference.mean())
        self.assertAlmostEqual(score["z"], (s.iloc[-1] - reference.mean()) / reference.std(ddof=1))
        self.assertEqual(score["percentile"], 100)

    def test_value_orientation_does_not_invert_price_score(self):
        s = self.history()
        price = f.score(s, "2010-11-29")
        value = f.score(s, "2010-11-29", direction=-1)
        self.assertEqual(value["z"], -price["z"])
        self.assertEqual(value["percentile"], 0)

    def test_insufficient_flat_and_stale_histories_stay_missing(self):
        s = self.history(60)
        self.assertIsNone(f.score(s, "2005-01-30")["z"])
        s = self.history(); s[:] = 3
        self.assertIsNone(f.score(s, "2010-11-29")["z"])
        self.assertIsNone(f.score(self.history(), "2012-01-30")["z"])

    def test_history_minimum_counts_native_quarters_not_repeated_months(self):
        s = pd.Series(range(20), index=pd.period_range("2000Q1", periods=20, freq="Q"))
        self.assertIsNone(f.score(s, "2005-02-28", quarterly=True, max_age=185)["z"])
        s.loc[pd.Period("2005Q1")] = 20
        self.assertIsNotNone(f.score(s, "2005-04-29", quarterly=True, max_age=185)["z"])

    def test_original_vintage_never_borrows_a_current_revision(self):
        source = {"series": "X", "availableCutoffs": ["2005-01-30"], "observations": [
            {"date": "2004-12-01", "X_20050130": "2", "X_20261021": "999"},
            {"date": "2005-02-01", "X_20050130": "5"}]}
        self.assertEqual(f.vintage(source, "2005-01-30"), [("2004-12-01", 2)])
        self.assertEqual(f.vintage(source, "2004-12-30"), [])

    def test_native_period_must_have_ended_even_if_timestamp_is_its_start(self):
        self.assertEqual(len(f.native([("2005-01-01", 1)], "2005-02-15", "Q")), 0)
        self.assertEqual(len(f.native([("2005-01-01", 1)], "2005-02-15", "M")), 1)

    def test_saar_profit_average_and_same_quarter_alignment(self):
        ix = pd.period_range("2000Q1", periods=6, freq="Q")
        profits = pd.Series([100.] * 6, index=ix)
        capitalisation = pd.Series([2000.] * 6, index=ix)
        result = f.equity_measure(profits, capitalisation)
        np.testing.assert_allclose(result, 5)
        self.assertEqual(len(result), 3)
        missing = profits.drop(ix[2])
        self.assertEqual(len(f.equity_measure(missing, capitalisation)), 0)

    def test_deflator_requires_matching_month_and_positive_levels(self):
        ix = pd.period_range("2000-01", periods=3, freq="M")
        result = f.matched_log_ratio(pd.Series([10, -1, 30], index=ix), pd.Series([2, 2], index=ix[1:]))
        self.assertEqual(result.index.tolist(), [ix[2]])
        self.assertAlmostEqual(result.iloc[0], np.log(15))

    def test_equity_duplicate_audit_requires_the_same_latest_reference_quarter(self):
        quarters = pd.period_range('2015Q1', periods=2, freq='Q')
        old = pd.Series([22443.89], index=quarters[:1])
        replacement = pd.Series([22384.033, 22137.801], index=quarters)
        check = f.compare_equity_duplicates(old, replacement, '2015-09-29')
        self.assertEqual(check['status'], 'different-latest-periods')
        self.assertNotIn('relativeDifference', check)
        same = f.compare_equity_duplicates(old, pd.Series([22443.893], index=quarters[:1]), '2015-08-30')
        self.assertEqual(same['status'], 'matched')
        self.assertLess(same['relativeDifference'], .0001)

    def test_split_adjustment_excludes_future_actions_and_current_month(self):
        frame = pd.DataFrame({"timestamp": ["2000-01-31", "2000-02-29", "2000-03-31", "2000-04-20"],
            "close": [100, 50, 55, 999], "adjusted close": [1, 2, 3, 4]})
        events = [{"date": "2000-02-15", "numerator": 2, "denominator": 1}]
        before = f.split_adjusted_closes(frame, "2000-02-10", events)
        self.assertEqual(before.iloc[0], 100)
        after = f.split_adjusted_closes(frame, "2000-04-21", events)
        np.testing.assert_allclose(after, [50, 50, 55])
        frame["adjusted close"] = 99999
        np.testing.assert_allclose(f.split_adjusted_closes(frame, "2000-04-21", events), after)

    def test_price_z_is_invariant_to_share_unit_changes(self):
        s = self.history()
        first = f.score(np.log(s), "2010-11-29")["z"]
        second = f.score(np.log(s / 10), "2010-11-29")["z"]
        self.assertAlmostEqual(first, second)


def sample(n=120):
    rng = np.random.default_rng(19)
    dates = pd.date_range("2000-01-31", periods=n, freq="BME")
    frame = pd.DataFrame({"cutoff": (dates - pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
        "activity": rng.normal(size=n), "inflationGap": rng.normal(size=n),
        "growth": rng.normal(size=n), "inflation": rng.normal(size=n)})
    return frame, rng.normal(size=(n, 5)), rng.normal(size=(n, 5)), rng.normal(.03, .1, (n, 5)), dates


class Models(unittest.TestCase):
    def test_future_labels_and_features_cannot_change_earlier_predictions(self):
        for h in [3, 12, 36]:
            frame, value, price, y, dates = sample()
            ends = (dates + pd.offsets.MonthEnd(h)).to_numpy()
            before, _, _ = b.forecasts(frame, value, price, y, ends)
            value[100:] = 999; price[100:] = -999; y[100:] = 999
            after, _, _ = b.forecasts(frame, value, price, y, ends)
            for model in b.MODELS:
                np.testing.assert_allclose(before[model][:100], after[model][:100], equal_nan=True)

    def test_all_models_share_input_eligibility_and_do_not_zero_fill(self):
        frame, value, price, y, dates = sample()
        value[95, 2] = np.nan
        pred, counts, valid = b.forecasts(frame, value, price, y, (dates + pd.offsets.MonthEnd(12)).to_numpy())
        self.assertFalse(valid[95])
        for model in b.MODELS:
            self.assertTrue(np.isnan(pred[model][95]).all())
            np.testing.assert_array_equal(np.isfinite(pred[model]).all(axis=1), np.isfinite(pred['full']).all(axis=1))

    def test_asset_receives_its_own_value_and_price_not_other_assets(self):
        frame, value, price, _, _ = sample()
        macro = frame[b.engine.BLOCKS['combined']].to_numpy()
        x = b.model_inputs(macro, value, price, 'full', 2)
        value[:, 1] = 999; price[:, 1] = 999
        np.testing.assert_allclose(x, b.model_inputs(macro, value, price, 'full', 2))
        np.testing.assert_allclose(x[:, -2], value[:, 2])
        np.testing.assert_allclose(x[:, -1], price[:, 2])

    def test_current_or_unmatured_outcomes_do_not_enter_training(self):
        frame, value, price, y, dates = sample()
        ends = (dates + pd.offsets.MonthEnd(12)).to_numpy()
        pred, counts, _ = b.forecasts(frame, value, price, y, ends)
        t = 95
        mature = ends <= np.datetime64(frame.cutoff.iloc[t])
        self.assertEqual(counts[t], mature.sum())
        changed = y.copy(); changed[~mature] = 999
        other, _, _ = b.forecasts(frame, value, price, changed, ends)
        for model in b.MODELS:
            np.testing.assert_allclose(pred[model][t], other[model][t])

    def test_primary_family_includes_both_incremental_signals(self):
        self.assertEqual(len(b.PRIMARY), 4)
        self.assertIn(('full', 'macro-price'), b.PRIMARY)
        self.assertIn(('full', 'macro-value'), b.PRIMARY)
        tests = [{'available': True, 'p': .01}] * 4
        self.assertEqual(b.engine.holm([dict(t) for t in tests])[0]['holmP'], .04)

    def test_price_experiment_has_a_separate_explicit_cohort(self):
        frame, value, price, y, dates = sample()
        value[:] = np.nan
        ends = (dates + pd.offsets.MonthEnd(12)).to_numpy()
        full, _, eligible = b.forecasts(frame, value, price, y, ends)
        exploratory, _, price_eligible = b.forecasts(frame, value, price, y, ends, False)
        self.assertFalse(eligible.any())
        self.assertTrue(price_eligible.all())
        self.assertTrue(np.isnan(full['full']).all())
        self.assertTrue(np.isfinite(exploratory['macro-price'][-1]).all())
        self.assertEqual(set(exploratory), {'mean', 'macro', 'price', 'macro-price'})


class Acquisition(unittest.TestCase):
    def test_http_200_maintenance_html_cannot_be_cached_as_data(self):
        class Maintenance:
            ok = True
            def json(self): raise ValueError('maintenance')
        with patch.object(a.requests, 'get', return_value=Maintenance()), patch.object(a.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'unavailable'):
                a.fred_json('series', {'series_id': 'GS10'}, 'private-test-key')


if __name__ == '__main__':
    unittest.main()
