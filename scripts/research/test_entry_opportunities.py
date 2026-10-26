import unittest
import numpy as np
import pandas as pd
from entry_opportunities import (quadrant, direction, distance, conditions, cohort,
                                 summarize_cell, bootstrap, holm, select_temporal)


class EntryOpportunityTests(unittest.TestCase):
    def records(self, n=80):
        return [{'reference': str(m), 'entry': str(m+2), 'exit': str(m+14),
                 'state': 'above-below' if i % 4 < 2 else 'below-above',
                 'trend': 'flat/rising', 'distance': 'intermediate/distant',
                 'nearBoundary': False}
                for i, m in enumerate(pd.period_range('1990-01', periods=n, freq='M'))]

    def test_numerical_anchor_tolerance_and_fixed_distance_edges(self):
        self.assertEqual(quadrant(.2, 100*(102/100-1)), 'boundary')
        self.assertEqual(quadrant(1e-12, 3), 'boundary')
        self.assertEqual(quadrant(.2, 3), 'above-above')
        self.assertIsNone(quadrant(np.nan, 3))
        self.assertEqual(direction(.1+1e-15, .1), 'flat')
        self.assertEqual(distance(.1, .1, .5), 'near')
        self.assertEqual(distance(-.5, .1, .5), 'intermediate')
        self.assertEqual(distance(-.50001, .1, .5), 'distant')

    def test_trend_requires_four_exact_consecutive_reference_pairs(self):
        points = [{'month': str(m), 'activity': .2, 'inflation': 3}
                  for m in pd.period_range('2000-01', periods=5, freq='M')]
        a, _ = conditions(points)
        self.assertEqual(len(a), 2)
        b, _ = conditions([p for p in points if p['month'] != '2000-03'])
        self.assertEqual(b, {})

    def test_entry_lag_horizon_maturity_and_no_missing_price_bridge(self):
        index = pd.period_range('2000-01', periods=8, freq='M')
        p = pd.DataFrame({'A': 100*1.1**np.arange(8), 'CASH': 100}, index=index)
        features = {index[0]: {'state': 'above-above'}, index[3]: {'state': 'below-below'}}
        rows, returns = cohort(p, features, 3)
        self.assertEqual(rows[0]['entry'], '2000-03')
        self.assertEqual(rows[0]['exit'], '2000-06')
        self.assertEqual(len(rows), 1)
        self.assertAlmostEqual(returns[0, 0], 1.1**3-1)
        self.assertEqual(cohort(p.drop(index[3]), features, 3)[0], [])

    def test_own_asset_baseline_and_support_are_not_other_assets(self):
        records = self.records(80)
        mask = np.array([r['state'] == 'above-below' for r in records])
        y = np.where(mask, .3, .1)
        s = summarize_cell(records, y, mask, 12)
        self.assertAlmostEqual(s['baseline'], .2)
        self.assertAlmostEqual(s['lift'], .1)
        self.assertEqual(s['n'], 40)
        self.assertEqual(s['episodes'], 20)
        self.assertTrue(s['supported'])
        self.assertLess(s['nonoverlappingStarts'], s['n'])
        self.assertAlmostEqual(s['worstLiftWithoutOneEpisode'], .3-y[2:].mean())

    def test_calendar_gaps_break_episodes(self):
        records = self.records(4)
        records.pop(1)
        s = summarize_cell(records, np.array([.1, .2, .3]), np.ones(3, dtype=bool), 3)
        self.assertEqual(s['episodes'], 2)
        self.assertFalse(s['supported'])

    def test_decade_matching_removes_a_pure_era_effect(self):
        r = self.records(120)
        for i in range(120):
            r[i]['entry'] = ('1990' if i < 60 else '2000')+'-'+f'{i % 12+1:02}'
        y = np.array([.1]*60+[.5]*60)
        mask = np.array([False]*60+[True]*60)
        s = summarize_cell(r, y, mask, 12)
        self.assertAlmostEqual(s['lift'], .2)
        self.assertAlmostEqual(s['decadeMatchedLift'], 0)

    def test_bootstrap_is_paired_seeded_and_handles_constant_returns(self):
        records = self.records(80)
        masks = np.array([[i % 4 < 2, i % 4 >= 2] for i in range(80)], dtype=float)
        y = np.ones((80, 2))*.1
        a = bootstrap(records, y, masks, 12, draws=100)
        self.assertEqual(a, bootstrap(records, y, masks, 12, draws=100))
        np.testing.assert_allclose(a[0,0]['liftCI95'], [0,0], atol=1e-12)
        self.assertEqual(a[0,0]['bootstrapP'], 1)

    def test_holm_controls_the_whole_declared_family(self):
        self.assertEqual(holm([.01, .04, .03, None]), [.03, .06, .06, None])
        self.assertEqual(holm([None]), [None])

    def test_later_returns_cannot_select_the_development_winner(self):
        records = self.records(240)
        y = np.array([.5 if r['state']=='above-below' else .1 for r in records])
        a = select_temporal(records, y, 'state', '2000-01')
        y2 = y.copy()
        for i, r in enumerate(records):
            if r['entry'] >= '2000-01':
                y2[i] = -1 if r['state']=='above-below' else 9
        b = select_temporal(records, y2, 'state', '2000-01')
        self.assertEqual(a['condition'], b['condition'])
        self.assertEqual(a['developmentLift'], b['developmentLift'])
        self.assertLess(b['laterLift'], 0)
        self.assertLess(b['lastDevelopmentExit'], '2000-01')


if __name__ == '__main__':
    unittest.main()
