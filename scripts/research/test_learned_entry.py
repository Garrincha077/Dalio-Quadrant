import unittest
import numpy as np
import pandas as pd
from learned_entry import fit, score, feature, macro_frame, choose, validation_folds, enters, MIN_TRAIN


class SyntheticDataset:
    def __init__(self, horizon=3, future_change=False):
        self.prices = pd.DataFrame(index=pd.period_range('1973-01', '2010-12', freq='M'))
        self.horizon = horizon
        self.future_change = future_change
        self.rng = np.random.default_rng(7)
        self.values = {m: self.rng.normal(size=4) for m in self.prices.index}

    def x(self, m):
        x = self.values.get(m)
        if x is None:
            return None
        return x+100 if self.future_change and m >= pd.Period('2005-01', freq='M') else x

    def outcome(self, m, h, a):
        x = self.values.get(m)
        if x is None or m+h not in self.prices.index:
            return None
        y = .02+.04*x[0]-.02*x[1]
        return y+99 if self.future_change and m+h >= pd.Period('2005-01', freq='M') else y

    def train(self, refit, h, a):
        rows = [m for m in self.prices.index if m+h < refit]
        x = np.array([self.x(m) for m in rows]).reshape((-1,4))
        y = np.array([self.outcome(m,h,a) for m in rows])
        return rows,x,y


class LearnedEntryTests(unittest.TestCase):
    def data(self, n=180):
        rng=np.random.default_rng(14)
        x=rng.normal(size=(n,4))
        x[:,1]+=2
        y=.03+.1*x[:,0]-.05*(x[:,1]-2)
        return x,y,np.arange(n)[::-1]

    def test_ridge_fits_response_and_finite_training_transform(self):
        x,y,ages=self.data()
        model=fit(x,y,ages,{'id':'test','family':'linear','penalty':10,'halfLife':0})
        self.assertGreater(np.corrcoef(score(model,x),y)[0,1],.99)
        self.assertEqual(len(model['beta']),4)
        self.assertAlmostEqual(model['baseline'],float(y.mean()))
        self.assertTrue(np.isfinite(score(model,[[999,999,999,999]])).all())

    def test_curved_model_is_seven_features_and_clips_before_expansion(self):
        x,y,ages=self.data()
        model=fit(x,y,ages,{'id':'test','family':'curved','penalty':100,'halfLife':120})
        self.assertEqual(len(model['beta']),7)
        self.assertTrue(np.isfinite(score(model,[[1e100,1e100,1e100,1e100]])).all())
        self.assertLess(model['effectiveN'],len(y))

    def test_threshold_depends_only_on_training_distribution(self):
        x,y,ages=self.data()
        model=fit(x,y,ages,{'id':'test','family':'linear','penalty':100,'halfLife':0})
        threshold=model['threshold']
        score(model,[[999,-999,999,-999]])
        self.assertEqual(model['threshold'],threshold)
        self.assertAlmostEqual(threshold,float(np.quantile(score(model,x),.75)))

    def test_pooled_quadrants_and_no_macro_baseline(self):
        x,y,ages=self.data()
        q=fit(x,y,ages,{'id':'q','family':'fixed','a':0,'p':2})
        self.assertEqual(score(q,[[0,3,0,0]])[0],0)
        self.assertAlmostEqual(q['baseline'],float(y.mean()))
        zero=fit(x,y,ages,{'id':'unconditional','family':'unconditional'})
        np.testing.assert_equal(score(zero,x),np.zeros(len(x)))
        self.assertEqual(zero['threshold'],0)

    def test_numeric_score_noise_cannot_create_or_remove_an_entry(self):
        self.assertFalse(bool(enters(1e-15,0)))
        self.assertTrue(bool(enters(.01-1e-15,.01)))
        self.assertFalse(bool(enters(.009,.01)))

    def test_minimum_sample_and_no_future_scaler(self):
        x,y,ages=self.data()
        spec={'id':'test','family':'linear','penalty':100,'halfLife':0}
        with self.assertRaises(ValueError):fit(x[:59],y[:59],ages[:59],spec)
        first=fit(x[:100],y[:100],ages[:100],spec)
        changed=x.copy();changed[100:]*=1000
        second=fit(changed[:100],y[:100],ages[:100],spec)
        self.assertEqual(first,second)

    def test_exact_macro_bases_and_consecutive_trend(self):
        points=[{'date':str(m),'value':100+i} for i,m in enumerate(pd.period_range('1999-01',periods=18,freq='M'))]
        activity=[{'date':str(m),'value':i/10} for i,m in enumerate(pd.period_range('2000-01',periods=6,freq='M'))]
        frame=macro_frame({'PCEPI':{'observations':points},'CFNAIMA3':{'observations':activity}})
        self.assertIsNotNone(feature(frame,pd.Period('2000-04',freq='M')))
        del frame[pd.Period('2000-03',freq='M')]
        self.assertIsNone(feature(frame,pd.Period('2000-04',freq='M')))

    def test_nested_folds_purge_all_crossing_labels(self):
        ds=SyntheticDataset()
        cutoff=pd.Period('2005-01',freq='M')
        folds=validation_folds(ds,cutoff,36,'A')
        self.assertEqual(len(folds),5)
        for origin,rows,x,y,targets in folds:
            self.assertTrue(all(m+36<origin for m in rows))
            self.assertTrue(all(t[0]+36<cutoff for t in targets))
            self.assertGreaterEqual(len(y),MIN_TRAIN)

    def test_later_outcomes_cannot_change_nested_choice(self):
        cutoff=pd.Period('2005-01',freq='M')
        a,trace_a=choose(SyntheticDataset(),cutoff,12,'A')
        b,trace_b=choose(SyntheticDataset(future_change=True),cutoff,12,'A')
        self.assertEqual(a,b)
        self.assertEqual(trace_a,trace_b)
        self.assertFalse(trace_a['fallback'])

    def test_insufficient_validation_uses_predeclared_fallback(self):
        choices,trace=choose(SyntheticDataset(),pd.Period('1980-01',freq='M'),36,'A')
        self.assertTrue(trace['fallback'])
        self.assertEqual(choices['selected']['id'],'linear:100:0')


if __name__=='__main__':unittest.main()
