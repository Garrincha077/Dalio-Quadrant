"""Causal invariants of the research search, independent of private sources."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
import pandas as pd

spec=importlib.util.spec_from_file_location('v4_under_test',Path(__file__).with_name('experiment.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class Causality(unittest.TestCase):
    def test_current_and_future_prices_cannot_change_current_market_inputs(self):
        clock=pd.period_range('2000-01',periods=44,freq='M')
        series=pd.Series(100*np.exp(np.arange(44)*.01+np.sin(np.arange(44))*.02),index=clock)
        prices={a:series.copy() for a in m.ASSETS}
        frame=pd.DataFrame({'cashYield':np.ones(44)})
        before,vol=m.market_features(prices,clock,frame)
        for a in prices:prices[a].iloc[40:]*=1000
        after,vol_after=m.market_features(prices,clock,frame)
        np.testing.assert_allclose(before[40],after[40]);np.testing.assert_allclose(vol[40],vol_after[40])
        self.assertFalse(np.allclose(before[41],after[41]))

    def test_macro_change_uses_calendar_month_not_row_offset(self):
        clock=pd.PeriodIndex(['2020-01','2020-03','2020-04','2020-05'],freq='M')
        frame=pd.DataFrame({'activity':[1,2,4,8],'inflationGap':[3,5,7,9]})
        x=m.macro_features(frame,clock)
        np.testing.assert_allclose(x[2],[4,7,3,4])
        self.assertTrue(np.isnan(x[3]).all()) # February is missing.

    def test_training_excludes_immature_label_and_limits_only_past_starts(self):
        n=180;eligible=np.ones(n,bool);y=np.zeros((n,5))
        end=np.arange('2000-01','2015-01',dtype='datetime64[M]').astype('datetime64[ns]')
        train=m.training_indices(eligible,y,end,'2010-01-15',120)
        self.assertEqual(len(train),120);self.assertEqual(train[-1],120);self.assertEqual(train[0],1)
        y[140:]=1e12
        np.testing.assert_array_equal(train,m.training_indices(eligible,y,end,'2010-01-15',120))

    def test_selector_uses_mature_out_of_sample_scores_not_future_perfection(self):
        n=55;y=np.tile(np.arange(5),(n,1)).astype(float)
        p=np.stack([y.copy(),y[:,::-1].copy()])
        # First candidate wins known history; second becomes perfect after it.
        p[0,30:]=y[30:,::-1];p[1,30:]=y[30:]
        end=pd.date_range('2000-01-31',periods=n,freq='ME').to_numpy()
        cutoffs=['2002-06-01']*n
        configs=[m.configuration('market',100,0),m.configuration('market',10,0)]
        selected,choices,_=m.select_candidates(configs,p,y,end,cutoffs,['market'])
        self.assertEqual(choices['market'][-1]['candidate'],configs[0]['id'])
        self.assertEqual(choices['market'][-1]['selectionCount'],29)
        mutated=y.copy();mutated[30:]*=-999
        again,other,_=m.select_candidates(configs,p,mutated,end,cutoffs,['market'])
        self.assertEqual(other['market'][-1]['candidate'],configs[0]['id'])
        np.testing.assert_array_equal(selected['market'],again['market'])

    def test_selector_waits_for_24_mature_prior_predictions(self):
        y=np.tile(np.arange(5),(30,1)).astype(float);p=y[None]
        end=pd.date_range('2000-01-31',periods=30,freq='ME').to_numpy()
        selected,choices,_=m.select_candidates([m.configuration('market',100,0)],p,y,end,['2001-12-01']*30,['market'])
        self.assertEqual(choices['market'],[]);self.assertTrue(np.isnan(selected['market']).all())


class AllocationAndEvidence(unittest.TestCase):
    def test_equal_forecasts_preserve_inverse_vol_reference(self):
        vol=np.array([.2,.1,.3,.08,.25]);base=1/vol;base/=base.sum()
        np.testing.assert_allclose(m.allocation(np.ones(5),vol),base)

    def test_tilts_are_long_only_bounded_and_keep_all_assets(self):
        w=m.allocation(np.arange(5),np.ones(5))
        np.testing.assert_allclose(w,[.1,.15,.2,.25,.3]);self.assertAlmostEqual(w.sum(),1)
        self.assertTrue(np.all(w>=0));self.assertAlmostEqual(w[-1]/w[0],3)
        self.assertEqual(m.allocation(np.full(5,np.nan),np.ones(5)).sum(),0)

    def test_rank_ic_handles_ties_and_missing_and_matches_hand_calculation(self):
        a=np.array([[1,1,2,3,4],[1,2,3,4,5],[np.nan,1,2,3,4]])
        b=np.array([[4,4,3,1,2],[5,4,3,2,1],[1,2,3,4,5]])
        values=m.rank_ic_matrix(a,b)
        # Average ranks give covariance -8.5 and each squared norm 9.5.
        self.assertAlmostEqual(values[0],-17/19)
        self.assertAlmostEqual(values[1],-1);self.assertTrue(np.isnan(values[2]))

    def test_sharpe_comparison_is_paired_and_missing_data_refused(self):
        a=np.sin(np.arange(72))*.02+.005;cash=np.full(72,.001)
        result=m.bootstrap_pair(a,a,12,True,cash)
        self.assertEqual(result['difference'],0);self.assertEqual(result['lower95'],0);self.assertEqual(result['p'],1)
        with self.assertRaises(ValueError):m.bootstrap_pair(a,np.r_[np.nan,a[1:]],12,True,cash)

    def test_configuration_budget_is_symmetric(self):
        self.assertEqual(len(m.SETTINGS),6)
        self.assertEqual((3+4)*len(m.SETTINGS)*2,84)
        self.assertEqual(m.SETTINGS[0],(100,0))


if __name__=='__main__':unittest.main()
