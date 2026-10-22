import unittest
import numpy as np
import pandas as pd
import experiment as lab
import policy


class UtilitySelection(unittest.TestCase):
    def frame(self,n=60):
        dates=pd.date_range('2000-01-31',periods=n,freq='ME')
        return pd.DataFrame({'tradeDate':dates.strftime('%Y-%m-%d'),
            'cutoff':(dates-pd.Timedelta(days=1)).strftime('%Y-%m-%d')})

    def test_current_month_return_is_not_available_before_execution(self):
        frame=self.frame();mask=np.ones(len(frame),bool)
        known=policy.earlier_holdings(mask,frame,30)
        self.assertEqual(known[-1],28)
        self.assertEqual(len(known),29)
        self.assertLessEqual(frame.tradeDate.iloc[known[-1]+1],frame.cutoff.iloc[30])

    def test_future_candidate_profit_cannot_select_current_model(self):
        n=60;frame=self.frame(n);clock=np.arange(n)
        returns=np.stack([.01+.01*np.sin(clock),-.01+.01*np.sin(clock)])
        predictions=np.stack([np.tile(np.arange(5),(n,1)),np.tile(np.arange(5)[::-1],(n,1))]).astype(float)
        configs=[lab.configuration('market',100,0),lab.configuration('market',10,0)]
        chosen,path=policy.utility_select(configs,predictions,returns,np.zeros(n),np.ones(n,bool),frame)
        returns[1,29:]=1000
        other,other_path=policy.utility_select(configs,predictions,returns,np.zeros(n),np.ones(n,bool),frame)
        np.testing.assert_array_equal(chosen['market'][30],other['market'][30])
        self.assertEqual(next(r for r in path['market'] if r['index']==30)['candidate'],configs[0]['id'])
        self.assertEqual(next(r for r in other_path['market'] if r['index']==30)['candidate'],configs[0]['id'])

    def test_switching_model_charges_real_selected_turnover(self):
        # Standalone candidates each hold one asset, whereas switching between
        # them incurs both a sale and a purchase at the selected policy level.
        w=np.array([[0,1,0,0,0,0],[0,0,1,0,0,0]],float)
        net,cost,_=lab.engine.net_returns(w,np.zeros_like(w),10)
        np.testing.assert_allclose(cost,[.001,.002]);np.testing.assert_allclose(net,[-.001,-.002])


if __name__=='__main__':unittest.main()
