import unittest
import numpy as np
import pandas as pd
import risk
import experiment as lab


class RiskCausality(unittest.TestCase):
    def test_risk_inputs_exclude_decision_month_and_last_incomplete_interval(self):
        market=np.ones((50,5,4));r=np.full((50,5),.01);cash=np.zeros(50)
        before=risk.risk_inputs(market,r,cash)
        r[39:]=10
        after=risk.risk_inputs(market,r,cash)
        np.testing.assert_allclose(before[40],after[40])
        self.assertFalse(np.allclose(before[41],after[41]))

    def test_future_risk_target_uses_exact_future_intervals_and_maturity(self):
        r=np.tile(np.arange(1,11)[:,None]*.01,(1,5));cash=np.full(10,.001)
        clock=pd.period_range('2020-01',periods=10,freq='M')
        y,end=risk.risk_labels(r,cash,clock,3)
        np.testing.assert_allclose(y[1],12*np.mean((np.array([.02,.03,.04])-.001)**2))
        self.assertEqual(str(end[1])[:10],'2020-05-31')
        self.assertTrue(np.isnan(y[-3:]).all())

    def test_qlike_prefers_correct_variance_to_under_or_over_forecast(self):
        actual=np.array([.01,.02,.03,.04,.05])
        exact=risk.qlike(actual,actual)
        self.assertLess(exact,risk.qlike(actual*2,actual))
        self.assertLess(exact,risk.qlike(actual/2,actual))

    def test_risk_selection_cannot_use_unmatured_future_variance(self):
        actual=np.full((55,5),.04)
        prediction=np.stack([actual.copy(),actual*10])
        prediction[0,30:]*=100;prediction[1,30:]=actual[30:]
        end=pd.date_range('2000-01-31',periods=55,freq='ME').to_numpy()
        configs=[lab.configuration('market',100,0),lab.configuration('market',10,0)]
        _,choice=risk.select(configs,prediction,actual,end,['2002-06-01']*55)
        self.assertEqual(choice['market'][-1]['candidate'],configs[0]['id'])
        self.assertEqual(choice['market'][-1]['selectionCount'],29)


if __name__=='__main__':unittest.main()
