import importlib.util
from pathlib import Path
import unittest
import copy
import json
import numpy as np
spec=importlib.util.spec_from_file_location('return_test_engine',Path(__file__).with_name('experiment.py'));lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
spec=importlib.util.spec_from_file_location('annual_forward_test',Path(__file__).with_name('forward.py'));forward=importlib.util.module_from_spec(spec);spec.loader.exec_module(forward)
class ReturnTests(unittest.TestCase):
    def test_constant_features_return_earlier_arithmetic_mean(self):
        x=np.ones((156,7));y=np.linspace(-.1,.3,156);p,_=lab.fit_predict(x,y,np.ones(7),['mean','market','stress'])
        for v in p.values():self.assertAlmostEqual(v,y.mean())
    def test_target_centering_and_intercept_are_not_penalized(self):
        x=np.arange(156*7,dtype=float).reshape(156,7)/100;y=np.linspace(-.1,.3,156)
        a,_=lab.fit_predict(x,y,x[-1],['stress']);b,_=lab.fit_predict(x,y+.01,x[-1],['stress']);self.assertAlmostEqual(b['stress']-a['stress'],.01)
    def test_mean_model_cannot_use_current_feature_to_choose_return(self):
        x=np.ones((156,7));y=np.linspace(-.1,.3,156);a,_=lab.fit_predict(x,y,np.ones(7),['mean']);b,_=lab.fit_predict(x,y,np.ones(7)*100,['mean']);self.assertEqual(a,b)
    def test_forecasts_are_bounded_and_hits_disclosed(self):
        p,d=lab.fit_predict(np.ones((156,7)),np.ones(156),np.ones(7),['mean']);self.assertEqual(p['mean'],.5);self.assertTrue(d['models']['mean']['boundHit'])
    def test_utility_allocation_is_long_only(self):
        self.assertEqual(lab.utility_weight(-.1,.04,.7),0.)
    def test_utility_respects_actual_cap(self):
        self.assertEqual(lab.utility_weight(.9,.01,.6),.6)
    def test_utility_uses_declared_risk_aversion(self):
        self.assertAlmostEqual(lab.utility_weight(.03,.04,.8),.25)
    def test_missing_risk_cannot_silently_become_zero(self):
        for v in [None,0,-1,float('nan')]:self.assertEqual(lab.utility_weight(.1,v,.8),0.)
    def test_same_week_maturity_is_unknown_at_preceding_day_cutoff(self):
        train=lab.risk_math.mature_training([True]*3,['2020-01-07','2020-01-14','2020-01-21'],np.ones(3),'2020-01-13',2)
        self.assertEqual(train.tolist(),[0])
    def test_forward_record_cannot_be_issued_after_target_starts(self):
        r=copy.deepcopy(json.loads((lab.ROOT/'data/return-forward-ledger.json').read_text())['records'][0]);self.assertTrue(forward.validate(r))
        r['issuedAt']='2026-10-28T00:00:00+00:00'
        with self.assertRaises(ValueError):forward.validate(r)
    def test_forward_record_cannot_hide_an_inferior_model(self):
        r=copy.deepcopy(json.loads((lab.ROOT/'data/return-forward-ledger.json').read_text())['records'][0]);del r['cohorts']['main']['forecasts']['mean']
        with self.assertRaises(ValueError):forward.validate(r)
    def test_forward_record_cannot_invent_outcomes_or_unknown_training_labels(self):
        source=json.loads((lab.ROOT/'data/return-forward-ledger.json').read_text())['records'][0]
        for mutation in ['outcome','training','independence']:
            r=copy.deepcopy(source)
            if mutation=='outcome':r['outcomes']={'return':.1}
            elif mutation=='training':r['cohorts']['main']['lastTrainingMaturity']='2026-10-20'
            else:r['sharedOutcomeCount']=12
            with self.assertRaises(ValueError):forward.validate(r)
if __name__=='__main__':unittest.main()
