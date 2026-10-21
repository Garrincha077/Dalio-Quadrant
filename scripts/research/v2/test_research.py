"""Causality, calendar, risk and immutable-ledger tests; no network/private inputs."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('research_v2',HERE/'backtest.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
spec=importlib.util.spec_from_file_location('forecast_ledger',HERE/'ledger.py')
l=importlib.util.module_from_spec(spec);spec.loader.exec_module(l)
spec=importlib.util.spec_from_file_location('chicago_source',HERE/'chicago.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)


def sample(n=150):
    rng=np.random.default_rng(8)
    dates=pd.date_range('2000-01-31',periods=n,freq='BME')
    frame=pd.DataFrame({'tradeDate':dates.strftime('%Y-%m-%d'),'cutoff':(dates-pd.Timedelta(days=1)).strftime('%Y-%m-%d'),
        'activity':rng.normal(size=n),'inflationGap':rng.normal(size=n),'growth':rng.normal(size=n),'inflation':rng.normal(size=n),
        'stateTrend':['rising/flat']*n})
    y=rng.normal(.03,.10,(n,5))
    return frame,y,dates


class Causality(unittest.TestCase):
    def test_future_labels_cannot_change_previous_forecasts_at_any_horizon(self):
        for h in [3,12,36]:
            frame,y,dates=sample()
            ends=(dates+pd.offsets.MonthEnd(h)).to_numpy()
            before,_=r.forecasts(frame,y,ends)
            changed=y.copy();changed[110:]=999
            after,_=r.forecasts(frame,changed,ends)
            for m in r.MODELS:
                np.testing.assert_allclose(before[m][:110],after[m][:110],equal_nan=True)

    def test_core_missingness_is_not_imputed_into_model_inputs(self):
        frame,y,dates=sample()
        frame.loc[90,'activity']=np.nan
        pred,count=r.forecasts(frame,y,(dates+pd.offsets.MonthEnd(12)).to_numpy())
        for m in r.MODELS:self.assertFalse(np.isfinite(pred[m][90]).any())
        own,_=r.forecasts(frame,y,(dates+pd.offsets.MonthEnd(12)).to_numpy(),False)
        self.assertTrue(np.isfinite(own['momentum'][90]).all())

    def test_maximum_history_references_do_not_require_unrelated_momentum(self):
        frame,y,dates=sample()
        frame.loc[:95,['growth','inflation']]=np.nan
        own,_=r.forecasts(frame,y,(dates+pd.offsets.MonthEnd(12)).to_numpy(),False)
        self.assertTrue(np.isfinite(own['state-trend'][90]).all())
        self.assertTrue(np.isfinite(own['unconditional'][90]).all())
        self.assertFalse(np.isfinite(own['combined'][90]).any())

    def test_labels_require_every_month_and_compound_cash_without_zero_filling(self):
        clock=pd.period_range('2000-01',periods=6,freq='M')
        prices={a:pd.Series([100,110,121,133.1,146.41,161.051],index=clock) for a in r.ASSETS}
        cash=np.array([.01]*5+[np.nan])
        labels,ends=r.labels(prices,clock,cash,3)
        self.assertAlmostEqual(labels[0,0],1.331-1.01**3)
        self.assertTrue(np.isnan(labels[3]).all())
        prices['SPY']=prices['SPY'].drop(clock[1])
        labels,_=r.labels(prices,clock,cash,3)
        self.assertTrue(np.isnan(labels[0,0]))
        self.assertTrue(np.isfinite(labels[0,1:]).all())

    def test_risk_estimate_uses_completed_prior_months_and_caps_exposure(self):
        clock=pd.period_range('2000-01',periods=80,freq='M')
        rng=np.random.default_rng(9)
        prices={a:pd.Series(100*np.cumprod(1+rng.normal(.005,.03,80)),index=clock) for a in r.ASSETS}
        target=np.array([1.,0,0,0,0])
        before=r.risk_weights(target,prices,clock,60)
        prices['SPY'].iloc[60:]=999999
        np.testing.assert_allclose(before,r.risk_weights(target,prices,clock,60))
        self.assertAlmostEqual(before.sum(),1)
        self.assertTrue((before>=0).all())
        self.assertLessEqual(before[1],1)
        prices['SPY']=prices['SPY'].drop(clock[50])
        np.testing.assert_allclose(r.risk_weights(target,prices,clock,60),[1,0,0,0,0,0])

    def test_no_advantage_does_not_become_a_significant_result(self):
        v=np.arange(120)/120
        test=r.bootstrap_difference(v,v,12)
        self.assertEqual(test['difference'],0)
        self.assertEqual(test['p'],1)
        tests=[{'available':True,'p':.01},{'available':True,'p':.04},{'available':True,'p':.03}]
        result=r.holm(tests)
        np.testing.assert_allclose([t['holmP'] for t in result],[.03,.06,.06])
        self.assertFalse(r.bootstrap_difference(v[:55],v[:55],36)['available'])

    def test_market_calendar_gap_withholds_strategy_instead_of_deleting_it(self):
        months=pd.PeriodIndex(['2000-01','2000-03'],freq='M')
        result=r.evaluate_strategy(np.array([[1,0,0,0,0,0]]*2),np.zeros((2,5)),np.zeros(2),np.ones(2,dtype=bool),months)
        self.assertFalse(result['available'])


class Ledger(unittest.TestCase):
    def record(self):
        return {'model':'combined','cutoff':'2026-10-29','tradeDate':'2026-10-30','executionAt':'2026-10-30T20:00:00Z',
          'horizon':12,'protocolSha256':'a'*64,'inputSha256':'b'*64,'modelArtifactSha256':'c'*64,'ranking':r.ASSETS.copy()}
    def empty(self):return {'version':'forecast-ledger-1','forecasts':[],'outcomes':[]}

    def test_backfills_and_future_information_cutoffs_are_rejected(self):
        for stamp in ['2026-10-31T00:00:00Z','2026-10-29T12:00:00Z','2026-10-30T20:00:00Z']:
            with self.assertRaises(ValueError):l.append_forecast(self.empty(),self.record(),stamp)

    def test_pre_execution_record_is_immutable_and_duplicate_is_idempotent(self):
        original=self.empty();value=self.record()
        first=l.append_forecast(original,value,'2026-10-30T10:00:00Z')
        self.assertEqual(original['forecasts'],[])
        self.assertEqual(len(l.append_forecast(first,value,'2026-10-30T11:00:00Z')['forecasts']),1)
        value['ranking']=value['ranking'][::-1]
        with self.assertRaises(ValueError):l.append_forecast(first,value,'2026-10-30T11:00:00Z')

    def test_outcome_requires_maturity_and_cannot_overwrite_forecast(self):
        first=l.append_forecast(self.empty(),self.record(),'2026-10-30T10:00:00Z')
        id=first['forecasts'][0]['id'];returns={a:.05 for a in r.ASSETS}
        with self.assertRaises(ValueError):l.append_outcome(first,id,returns,'2027-01-01T00:00:00Z')
        result=l.append_outcome(first,id,returns,'2027-11-01T00:00:00Z')
        self.assertEqual(result['forecasts'],first['forecasts'])
        self.assertEqual(len(result['outcomes']),1)
        returns['SPY']=.06
        with self.assertRaises(ValueError):l.append_outcome(result,id,returns,'2027-11-02T00:00:00Z')


class Chicago(unittest.TestCase):
    def test_source_release_date_controls_availability(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'2001-2011.xlsx'
            with pd.ExcelWriter(path) as writer:
                pd.DataFrame({'Date':[pd.Timestamp('1967-05-01'),pd.Timestamp('2001-01-01')],
                    'CF312001':[-.5,-.7]}).to_excel(writer,sheet_name='cfnai_realtime',index=False)
                pd.DataFrame([['release_date','cfnai_month'],[pd.Timestamp('2001-03-05'),pd.Timestamp('2001-01-01')]]).to_excel(writer,sheet_name='release_dates',index=False,header=False)
            self.assertEqual(c.parse_book(path,'2001-03-01'),[])
            result=c.parse_book(path,'2001-03-05')
            self.assertEqual(result[0]['releasedAt'],'2001-03-05')
            self.assertEqual(result[0]['observations'][1]['value'],-.7)


if __name__=='__main__': unittest.main()
