"""Causality, self-financing execution and source-quality regression checks."""
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from extended_state import (state_frame, describe_states, revised_signals, vintage_signal,
                            matured_rows, ranking, shares, rebalance, simulate,
                            performance, paired_interval, load_panel)


def fixture(n=120):
    ix = pd.period_range('2002-01', periods=n, freq='M')
    prices = pd.DataFrame({a: 100*(1+r)**np.arange(n)
                           for a, r in [('A', .01), ('B', .002), ('C', -.001), ('D', .003), ('CASH', .0005)]}, index=ix)
    dates = {m: str(m.end_time.date()) for m in ix}
    frame = state_frame([{'month': str(m), 'activity': .2, 'inflation': 3.}
                         for m in pd.period_range(ix.min()-6, ix.max(), freq='M')])
    return prices, dates, revised_signals(frame, dates)


class ExtendedStateTests(unittest.TestCase):
    def test_anchor_mixture_matches_live_rule(self):
        np.testing.assert_allclose(shares(.01, 3.4), [.55, 0, .45, 0])
        np.testing.assert_allclose(shares(0, 2), [.25]*4)

    def test_trend_requires_exact_calendar_not_row_offset(self):
        frame = state_frame([{'month': m, 'activity': .2, 'inflation': 3}
                             for m in ['2020-01', '2020-02', '2020-04', '2020-05']])
        self.assertEqual(revised_signals(frame, {pd.Period('2020-07', freq='M'): '2020-07-31'}), {})

    def test_episodes_and_transitions_do_not_bridge_a_missing_month(self):
        f = state_frame([{'month': m, 'activity': .2, 'inflation': 3}
                         for m in ['2020-01', '2020-02', '2020-04']])
        result = describe_states(f)
        self.assertEqual(result['quadrants'][0]['episodes'], 2)
        self.assertEqual(result['quadrants'][0]['longestRun'], 2)
        self.assertEqual(result['transitions']['above-above']['above-above'], 1)
        self.assertEqual(result['missingMonths'], ['2020-03'])

    def test_same_day_exit_does_not_enter_training(self):
        prices, dates, signals = fixture()
        decision = prices.index[72]
        rows, _ = matured_rows(signals, prices.iloc[:, :-1], decision)
        self.assertEqual(len(rows), 60)
        self.assertTrue(all(pd.Period(r['tradeDate'], freq='M')+12 < decision for r in rows))

    def test_future_prices_and_states_do_not_change_past_decisions(self):
        prices, dates, signals = fixture()
        original, _ = simulate(prices, dates, signals, '2008-01')
        changed = prices.copy()
        changed.loc[changed.index >= pd.Period('2010-01', freq='M'), 'A'] *= 10
        future = {m: dict(s) for m, s in signals.items()}
        for m in future:
            if m >= pd.Period('2010-01', freq='M'):
                future[m]['activity'] = -9
                future[m]['quadrant'] = 'below-above'
        altered, _ = simulate(changed, dates, future, '2008-01')
        for policy in original:
            before = [r for r in original[policy] if r['month'] < '2010-01']
            after = [r for r in altered[policy] if r['month'] < '2010-01']
            self.assertEqual(before, after)

    def test_pooled_ranking_uses_only_the_given_training_sample(self):
        _, _, signals = fixture()
        s = next(iter(signals.values()))
        rows = [s.copy() for _ in range(10)]
        values = np.tile([.1, .2, -.1, 0.], (10, 1))
        for mode in ('unconditional', 'state-only', 'state-trend'):
            np.testing.assert_allclose(ranking(s, rows, values, mode), values[0])

    def test_cash_to_risky_and_two_leg_costs_are_self_financing(self):
        bought, fee, turnover = rebalance([0, 100], [1, 0], .001)
        self.assertAlmostEqual(bought[0], 100/1.001)
        self.assertAlmostEqual(fee, turnover*.001)
        switched, fee, turnover = rebalance([100, 0, 0], [0, 1, 0], .001)
        self.assertAlmostEqual(switched[1], 100*.999/1.001)
        self.assertAlmostEqual(fee, turnover*.001)
        self.assertAlmostEqual(switched.sum()+fee, 100)

    def test_renewing_same_asset_has_no_fictitious_turnover(self):
        values, fee, traded = rebalance([100, 0], [1, 0], .0025)
        np.testing.assert_allclose(values, [100, 0])
        self.assertAlmostEqual(fee, 0)
        self.assertAlmostEqual(traded, 0)

    def test_sleeve_holds_after_new_signal_becomes_unavailable(self):
        prices, dates, signals = fixture()
        start = pd.Period('2008-01', freq='M')
        signals.pop(start+1)
        records, audit = simulate(prices, dates, signals, str(start))
        self.assertEqual(audit[0]['choices']['state-trend'], 'A')
        self.assertEqual(audit[1]['choices']['state-trend'], 'CASH')
        # Prior sleeve remains invested despite the next month's missing data.
        self.assertGreater(records['state-trend'][1]['return'], records['cash'][1]['return'])
        self.assertEqual(audit[1]['choices']['unconditional'], 'CASH')

    def test_drawdown_includes_initial_wealth_and_sharpe_uses_cash(self):
        r = performance([{'return': -.2, 'costFraction': 0, 'grossTradedFraction': 0}], [0])
        self.assertAlmostEqual(r['monthlyMaxDrawdown'], -.2)
        self.assertIsNone(r['excessSharpe'])

    def test_paired_bootstrap_is_seeded_and_does_not_claim_small_samples(self):
        a, b = [.01]*60, [0]*60
        self.assertEqual(paired_interval(a, b), paired_interval(a, b))
        np.testing.assert_allclose(paired_interval(a, b)['interval95'], [.12, .12])
        self.assertIsNone(paired_interval([0]*12, [0]*12)['interval95'])

    def test_vintage_signal_timing_freshness_and_latest_month_alignment(self):
        rows = pd.period_range('2019-01', '2020-05', freq='M')
        snapshot = {'cutoff': '2020-06-29', 'series': {
            'CFNAIMA3': {'observations': [{'date': str(m), 'value': .2} for m in rows if m >= pd.Period('2020-01', freq='M')]},
            'PCEPI': {'observations': [{'date': str(m), 'value': 100+int(m.ordinal-rows[0].ordinal)} for m in rows]}}}
        self.assertEqual(vintage_signal(snapshot, '2020-06-30')['reference'], '2020-05')
        snapshot['series']['CFNAIMA3']['observations'].pop()
        self.assertIsNone(vintage_signal(snapshot, '2020-06-30'))
        snapshot['cutoff'] = '2020-06-30'
        with self.assertRaises(ValueError):
            vintage_signal(snapshot, '2020-06-30')
        snapshot['cutoff'] = '2000-06-29'
        with self.assertRaises(ValueError):
            vintage_signal(snapshot, '2000-06-30')

    def test_manifest_rejects_yield_as_bond_return_and_internal_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            assets = {a: {'source': 'documented source', 'instrument': a, 'currency': 'USD', 'returnType': 'total-return'} for a in 'ABCD'}
            data = {'assets': assets, 'cash': {'source': 'source', 'instrument': 'cash', 'currency': 'USD', 'returnType': 'total-return'}, 'prices': 'prices.csv'}
            prices, dates, _ = fixture()
            prices.insert(0, 'date', list(dates.values()))
            prices.to_csv(p/'prices.csv', index=False)
            (p/'manifest.json').write_text(json.dumps(data))
            self.assertEqual(len(load_panel(p/'manifest.json', '2012-01-01')[0]), 120)
            assets['B']['returnType'] = 'yield'
            (p/'manifest.json').write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                load_panel(p/'manifest.json', '2012-01-01')
            assets['B']['returnType'] = 'total-return'
            (p/'manifest.json').write_text(json.dumps(data))
            prices.drop(prices.index[4]).to_csv(p/'prices.csv', index=False)
            with self.assertRaises(ValueError):
                load_panel(p/'manifest.json', '2012-01-01')


if __name__ == '__main__':
    unittest.main()
