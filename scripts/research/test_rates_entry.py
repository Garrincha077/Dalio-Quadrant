import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from rates_entry import (monthly_values, trailing_return, expand, fit, predict,
                         rank_score, choose, compare, candidates, RateSource, MarketDataset)
from zscore_entry import folds_at
from extended_state import digest


class Synthetic:
    def __init__(self, changed=False):
        self.prices = pd.DataFrame(index=pd.period_range('1973-01', '2010-12', freq='M'))
        rng = np.random.default_rng(30)
        self.values = {m: rng.normal(size=8) for m in self.prices.index}; self.changed = changed

    def x(self, m, asset):
        value = self.values.get(m)
        return value*1000 if self.changed and m>=pd.Period('2005-01', freq='M') else value

    def outcome(self, m, h, asset):
        if m not in self.values or m+h not in self.prices.index:
            return None
        return .03+.08*self.values[m][6]+.02*self.values[m][-1]+(999 if self.changed and m+h>=pd.Period('2005-01', freq='M') else 0)

    def train(self, refit, h, asset):
        rows = [m for m in self.prices.index if m+h<refit]
        return rows, np.array([self.x(m, asset) for m in rows]), np.array([self.outcome(m, h, asset) for m in rows])


class RatesEntryTests(unittest.TestCase):
    def test_negative_real_yields_are_valid_and_missing_values_stay_absent(self):
        values = monthly_values([{'date':'2003-01-01','value':'-0.75'},{'date':'2003-02-01','value':'.'}], '2003-03-30')
        self.assertEqual(values[pd.Period('2003-01',freq='M')], -.75)
        self.assertNotIn(pd.Period('2003-02',freq='M'), values)

    def test_monthly_frequency_duplicates_future_dates_and_nonfinite_are_rejected(self):
        for rows in [[{'date':'2003-01-02','value':'1'}], [{'date':'2003-04-01','value':'1'}],
                     [{'date':'2003-01-01','value':'nan'}], [{'date':'2003-01-01','value':'1'}]*2]:
            with self.assertRaises(ValueError): monthly_values(rows, '2003-03-30')

    def test_twelve_month_trend_uses_thirteen_previous_closes(self):
        prices = pd.Series(np.arange(1,31), index=pd.period_range('2000-01',periods=30,freq='M'))
        entry = prices.index[20]
        self.assertAlmostEqual(trailing_return(prices,entry),20/8-1)
        prices.loc[entry:] *= 999
        self.assertAlmostEqual(trailing_return(prices,entry),20/8-1)
        self.assertIsNone(trailing_return(prices.drop(prices.index[15]),entry))

    def test_three_nested_feature_sets_for_both_cohorts(self):
        for count in [7,8]:
            x = np.ones((100,count))
            self.assertEqual(expand(x,'base').shape[1],5)
            self.assertEqual(expand(x,'rates').shape[1],count-1)
            self.assertEqual(expand(x,'trend').shape[1],count)

    def test_rate_features_can_be_learned_without_trend_leakage_into_rates_model(self):
        rng = np.random.default_rng(8); x = rng.normal(size=(200,8)); y = .02+.2*x[:,6]
        model = fit(x,y,np.arange(200),candidates('rates')[0])
        self.assertGreater(np.corrcoef(predict(model,x),y)[0,1],.99)
        changed=x.copy();changed[:,-1]*=999
        np.testing.assert_equal(predict(model,x),predict(model,changed))

    def test_base_excludes_all_added_rates_and_trend(self):
        rng=np.random.default_rng(9);x=rng.normal(size=(150,8));y=x[:,0]*.03
        model=fit(x,y,np.arange(150),candidates('base')[0]);changed=x.copy();changed[:,5:]*=100
        np.testing.assert_equal(predict(model,x),predict(model,changed))

    def test_rank_is_training_distribution_position_not_probability(self):
        model={'scorePercentiles':np.linspace(-.1,.1,21).tolist()}
        self.assertAlmostEqual(rank_score(model,0),50)
        self.assertEqual(rank_score(model,2),100);self.assertEqual(rank_score(model,-2),0)
        self.assertIsNone(rank_score({'scorePercentiles':None},0))
        self.assertIsNone(rank_score({'scorePercentiles':[0]*21},0))

    def test_percentiles_and_cutoff_depend_only_on_training_inputs(self):
        rng=np.random.default_rng(5);x=rng.normal(size=(120,8));y=x[:,0]*.02
        m=fit(x,y,np.arange(120),candidates('trend')[0]);before=json.dumps(m,sort_keys=True)
        self.assertTrue(np.isfinite(predict(m,[[1e99]*8])).all())
        self.assertEqual(json.dumps(m,sort_keys=True),before)
        with self.assertRaises(ValueError):fit(x[:59],y[:59],np.arange(59),candidates('trend')[0])

    def test_training_and_validation_holdings_have_matured(self):
        cutoff=pd.Period('2005-01',freq='M')
        for origin,rows,x,y,targets in folds_at(Synthetic(),cutoff,36,'A'):
            self.assertTrue(all(m+36<origin for m in rows))
            self.assertTrue(all(m+36<cutoff for m,_,_ in targets))

    def test_future_outcomes_and_market_features_cannot_rewrite_choice(self):
        cutoff=pd.Period('2005-01',freq='M')
        self.assertEqual(choose(Synthetic(),cutoff,12,'A'),choose(Synthetic(True),cutoff,12,'A'))

    def test_fallback_preserves_each_nested_stage(self):
        choices,trace=choose(Synthetic(),pd.Period('1980-01',freq='M'),36,'A')
        self.assertTrue(trace['fallback'])
        for stage,spec in choices.items():self.assertEqual(spec['id'],stage+':100:0')

    def test_incremental_comparison_uses_requested_pair_not_always_base(self):
        rows=[{'entry':str(m),'actual':i/100,'policies':{'base':{'enter':i<20},'rates':{'enter':i%2==0},'trend':{'enter':i%2==0}}}
              for i,m in enumerate(pd.period_range('2000-01',periods=60,freq='M'))]
        result=compare(rows,'trend','rates',12,100)
        self.assertEqual(result['gain'],0);self.assertEqual(result['gainCI95'],[0,0])
        self.assertNotEqual(compare(rows,'trend','base',12,100)['gain'],0)

    def test_missing_vintage_never_falls_back_to_revised_yield(self):
        source=RateSource.__new__(RateSource);source.cache={};m=pd.Period('2011-01',freq='M')
        source.schedule={m:'2011-01-30'};source.manifest={'asOf':'2026-10-26'}
        source.raw={id:{'snapshots':{},'revised':{'cutoff':'2026-10-26','observations':[{'date':'2010-12-01','value':'1'}]}} for id in ['GS10','FII10']}
        self.assertIsNone(source.frame(m,'vintage','real'))
        self.assertIsNotNone(source.frame(m,'revised','real'))

    def test_earlier_refit_ignores_revised_and_later_vintage_values(self):
        source=RateSource.__new__(RateSource);source.cache={}
        earlier,later=pd.Period('2011-01',freq='M'),pd.Period('2012-01',freq='M')
        source.schedule={earlier:'2011-01-30',later:'2012-01-30'};source.manifest={'asOf':'2026-10-26'}
        source.raw={id:{'snapshots':{'2011-01-30':{'cutoff':'2011-01-30','observations':[{'date':'2010-12-01','value':'1'}]},
                                   '2012-01-30':{'cutoff':'2012-01-30','observations':[{'date':'2010-12-01','value':'9'}]}},
                        'revised':{'cutoff':'2026-10-26','observations':[{'date':'2010-12-01','value':'99'}]}}
                    for id in ['GS10','FII10']}
        month=pd.Period('2010-12',freq='M')
        self.assertEqual(source.frame(earlier,'vintage','real')['FII10'][month],1)
        self.assertEqual(source.frame(later,'vintage','real')['FII10'][month],9)
        self.assertEqual(source.frame(earlier,'revised','real')['FII10'][month],99)

    def test_training_yield_reference_is_previous_month_and_absent_real_rate_withholds(self):
        dataset=MarketDataset.__new__(MarketDataset);dataset.price_features={};dataset.trends={};dataset.cohort='real'
        m=pd.Period('2010-05',freq='M');dataset.price_features[('A',m)]=1.;dataset.trends[('A',m)]=.1
        frame={m-i:(.1,2.1) for i in [2,3,4,5]}
        rates={'GS10':{m-1:4.},'FII10':{m-1:-.5}}
        x=dataset.combined(frame,rates,m,'A');self.assertEqual(list(x[-3:]),[4.,-.5,.1])
        rates['FII10']={m:-.5};self.assertIsNone(dataset.combined(frame,rates,m,'A'))


if __name__=='__main__':unittest.main()
