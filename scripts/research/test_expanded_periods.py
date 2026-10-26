import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from extended_state import digest
from expanded_periods import load_histories, IndependentDataset, point, period_comparison
from prepare_period_histories import checked, monthly_yahoo


class ExpandedPeriodsTests(unittest.TestCase):
    def fixture(self,folder):
        assets={}
        for i,name in enumerate(['A','B','C','D']):
            months=pd.period_range('2000-01',periods=20,freq='M')[i:20-i]
            file=folder/(name+'.csv')
            pd.DataFrame({'date':[str(m.end_time.date()) for m in months],'price':np.arange(len(months))+100}).to_csv(file,index=False)
            assets[name]={'prices':file.name,'pricesSha256':digest(file),'sourceFileSha256':'fixture','currency':'USD',
                'priceStart':str(months[0]),'priceEnd':str(months[-1]),'priceMonths':len(months)}
        meta={'version':'per-asset-histories-1','assets':assets};path=folder/'manifest.json';path.write_text(json.dumps(meta));return path,meta

    def test_short_asset_does_not_truncate_other_histories(self):
        with tempfile.TemporaryDirectory() as tmp:
            path,meta=self.fixture(Path(tmp));prices,dates,_=load_histories(path,'2002-01-01')
            self.assertEqual(len(prices),20);self.assertEqual(prices.A.notna().sum(),20);self.assertEqual(prices.D.notna().sum(),14)
            self.assertTrue(pd.isna(prices.D.iloc[0]));self.assertEqual(len(dates['D']),14)

    def test_interior_gap_is_not_accepted_as_an_outside_coverage_null(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);path,meta=self.fixture(folder);file=folder/'A.csv'
            raw=pd.read_csv(file);raw.drop(index=5).to_csv(file,index=False)
            meta['assets']['A']['pricesSha256']=digest(file);path.write_text(json.dumps(meta))
            with self.assertRaisesRegex(ValueError,'interior gap'):load_histories(path,'2002-01-01')

    def test_source_hash_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path,meta=self.fixture(Path(tmp));meta['assets']['A']['pricesSha256']='bad';path.write_text(json.dumps(meta))
            with self.assertRaisesRegex(ValueError,'provenance'):load_histories(path,'2002-01-01')

    def test_bounds_are_checked_against_actual_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            path,meta=self.fixture(Path(tmp));meta['assets']['A']['priceStart']='1999-01';path.write_text(json.dumps(meta))
            with self.assertRaisesRegex(ValueError,'bounds'):load_histories(path,'2002-01-01')

    def test_preparation_excludes_unfinished_month_and_gold_peg_history(self):
        series=pd.Series(np.arange(50)+100,index=pd.period_range('1970-01',periods=50,freq='M'))
        result=checked(series,'1974-01-26','1973-01')
        self.assertEqual(str(result.index.min()),'1973-01');self.assertEqual(str(result.index.max()),'1973-12')
        with self.assertRaisesRegex(ValueError,'gap'):checked(series.drop(series.index[40]),'1974-01-26','1973-01')

    def test_daily_provider_uses_last_actual_trade_date_not_first_month_bar(self):
        dt=pd.to_datetime(['2020-05-28T13:30Z','2020-05-29T13:30Z','2020-06-01T13:30Z'])
        raw={'chart':{'result':[{'timestamp':[int(t.timestamp()) for t in dt],
            'indicators':{'adjclose':[{'adjclose':[100.,101.,102.]}]}}]}}
        prices,dates=monthly_yahoo(raw)
        self.assertEqual(prices.iloc[0],101.);self.assertEqual(dates[pd.Period('2020-05',freq='M')],'2020-05-29')

    def test_unknown_endpoint_or_interior_price_withholds_outcome(self):
        dataset=IndependentDataset.__new__(IndependentDataset)
        ix=pd.period_range('2000-01',periods=6,freq='M');dataset.prices=pd.DataFrame({'A':[100,101,102,103,np.nan,np.nan],'B':[100,101,np.nan,103,104,105]},index=ix)
        self.assertIsNone(dataset.outcome(ix[0],5,'A'));self.assertIsNone(dataset.outcome(ix[0],3,'B'))
        self.assertAlmostEqual(dataset.outcome(ix[0],3,'A'),1.03*.999/1.001-1)

    def test_missing_vintage_schedule_cannot_become_earlier_etf_signal(self):
        dataset=IndependentDataset.__new__(IndependentDataset);m=pd.Period('1999-01',freq='M')
        dataset.asset_dates={'SPY':{m:'1999-01-29'}};dataset.information='vintage';dataset.metadata={'panel':'etf'};dataset.schedule={}
        self.assertIsNone(dataset.x(m,'SPY'))

    def test_mismatched_actual_trade_date_is_rejected_before_vintage_use(self):
        dataset=IndependentDataset.__new__(IndependentDataset);m=pd.Period('2012-01',freq='M')
        dataset.asset_dates={'SPY':{m:'2012-01-30'}};dataset.information='vintage';dataset.metadata={'panel':'etf'}
        dataset.schedule={m:{'tradeDate':'2012-01-31'}}
        with self.assertRaisesRegex(ValueError,'date differs'):dataset.x(m,'SPY')

    def test_empty_subset_is_not_a_zero_return_and_gaps_split_episodes(self):
        self.assertIsNone(point([],'base')['lift'])
        rows=[{'entry':m,'actual':v,'policies':{'base':{'enter':True}}} for m,v in [('2000-01',.1),('2000-03',.2)]]
        result=point(rows,'base');self.assertEqual(result['episodes'],2);self.assertEqual(result['lift'],0)


if __name__=='__main__':unittest.main()
