import unittest
import numpy as np
import pandas as pd
from zscore_entry import (trailing_z, expand, fit, predict, choose, folds_at,
                          incremental, POLICIES, candidates)


class Synthetic:
    def __init__(self, changed=False):
        self.prices = pd.DataFrame(index=pd.period_range('1973-01', '2010-12', freq='M'))
        rng = np.random.default_rng(17)
        self.values = {m: rng.normal(size=5) for m in self.prices.index}
        self.changed = changed

    def x(self, m, asset):
        v = self.values.get(m)
        return v*1000 if self.changed and m >= pd.Period('2005-01', freq='M') else v

    def outcome(self, m, h, asset):
        if m not in self.values or m+h not in self.prices.index:
            return None
        return .03+.05*self.values[m][4]+(999 if self.changed and m+h>=pd.Period('2005-01', freq='M') else 0)

    def train(self, refit, h, asset):
        rows = [m for m in self.prices.index if m+h<refit]
        return rows, np.array([self.x(m, asset) for m in rows]), np.array([self.outcome(m, h, asset) for m in rows])


class ZScoreEntryTests(unittest.TestCase):
    def price_series(self):
        return pd.Series(np.exp(np.arange(100)/20), index=pd.period_range('1999-01', periods=100, freq='M'))

    def test_exact_log_sample_sd_formula_and_previous_close(self):
        p = self.price_series(); m = p.index[70]; logs = np.log(p.iloc[34:70])
        self.assertAlmostEqual(trailing_z(p, m, 36), (logs.iloc[-1]-logs.mean())/logs.std(ddof=1))

    def test_entry_and_future_prices_cannot_rewrite_signal(self):
        p = self.price_series(); m = p.index[70]; old = trailing_z(p, m, 36)
        p.loc[m:] *= 5000
        self.assertEqual(old, trailing_z(p, m, 36))

    def test_price_units_and_rebasing_do_not_change_z(self):
        p = self.price_series(); m = p.index[70]
        self.assertAlmostEqual(trailing_z(p, m, 36), trailing_z(p*123.45, m, 36))

    def test_missing_nonpositive_flat_or_short_history_is_unavailable(self):
        p = self.price_series(); m = p.index[70]
        self.assertIsNone(trailing_z(p.drop(p.index[60]), m, 36))
        self.assertIsNone(trailing_z(p, p.index[10], 36))
        self.assertIsNone(trailing_z(p*0+5, m, 36))
        p.iloc[60] = 0; self.assertIsNone(trailing_z(p, m, 36))

    def test_larger_trailing_window_changes_reference_population(self):
        p = self.price_series(); m = p.index[70]
        self.assertNotAlmostEqual(trailing_z(p, m, 36), trailing_z(p, m, 60), places=4)

    def test_family_feature_dimensions_and_interactions(self):
        x = [[1, 2, 3, 4, 5]]
        for f, n in zip(POLICIES, [4, 1, 5, 9]):
            self.assertEqual(expand(x, f).shape, (1, n))
        np.testing.assert_equal(expand(x, 'interaction')[0, 5:], [5, 10, 15, 20])

    def test_price_family_learns_price_relationship_and_excludes_macro(self):
        rng = np.random.default_rng(3); x = rng.normal(size=(160, 5)); y = .02+.1*x[:, 4]
        m = fit(x, y, np.arange(160), candidates('price')[0])
        self.assertGreater(np.corrcoef(predict(m, x), y)[0, 1], .99)
        changed = x.copy(); changed[:, :4] *= 999
        np.testing.assert_equal(predict(m, x), predict(m, changed))

    def test_train_only_clipping_expansion_and_minimum_labels(self):
        rng = np.random.default_rng(4); x = rng.normal(size=(120, 5)); y = rng.normal(size=120)
        m = fit(x, y, np.arange(120), candidates('interaction')[0])
        self.assertEqual(len(m['beta']), 9)
        self.assertTrue(np.isfinite(predict(m, [[1e99]*5])).all())
        self.assertEqual(m, fit(x.copy(), y.copy(), np.arange(120), candidates('interaction')[0]))
        with self.assertRaises(ValueError): fit(x[:59], y[:59], np.arange(59), candidates('macro')[0])

    def test_validation_labels_and_training_labels_are_purged(self):
        cutoff = pd.Period('2005-01', freq='M')
        for origin, rows, x, y, targets in folds_at(Synthetic(), cutoff, 36, 'A'):
            self.assertTrue(all(m+36<origin for m in rows))
            self.assertTrue(all(m+36<cutoff for m, _, _ in targets))

    def test_future_prices_features_and_labels_cannot_change_selection(self):
        cutoff = pd.Period('2005-01', freq='M')
        self.assertEqual(choose(Synthetic(), cutoff, 12, 'A'), choose(Synthetic(True), cutoff, 12, 'A'))

    def test_fallback_preserves_each_declared_feature_family(self):
        choices, trace = choose(Synthetic(), pd.Period('1980-01', freq='M'), 36, 'A')
        self.assertTrue(trace['fallback'])
        for f, spec in choices.items():
            self.assertEqual(spec['family'], f); self.assertEqual(spec['penalty'], 100); self.assertEqual(spec['halfLife'], 0)

    def test_paired_gain_uses_identical_block_draws_and_handles_no_entry(self):
        rows = [{'entry': str(m), 'actual': i/100, 'policies': {'macro': {'enter': i%2==0}, 'joint': {'enter': i%2==0}}}
                for i, m in enumerate(pd.period_range('2000-01', periods=60, freq='M'))]
        r = incremental(rows, 'joint', 12, 200)
        self.assertEqual(r['gain'], 0); self.assertEqual(r['gainCI95'], [0, 0])
        for row in rows: row['policies']['joint']['enter'] = False
        r = incremental(rows, 'joint', 12, 200)
        self.assertIsNone(r['gain']); self.assertIsNone(r['bootstrapP'])


if __name__ == '__main__': unittest.main()
