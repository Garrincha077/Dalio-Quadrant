import importlib.util
from pathlib import Path
import unittest
import numpy as np
spec=importlib.util.spec_from_file_location('risk_experiment',Path(__file__).with_name('experiment.py'))
lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)

class ForwardRiskTests(unittest.TestCase):
    def test_training_excludes_targets_after_cutoff(self):
        ids=lab.mature_training([True]*4,['2020-01-01','2020-01-07','2020-01-14',None],np.ones(4),'2020-01-13',4)
        self.assertEqual(ids.tolist(),[0,1])
    def test_training_allows_known_boundary_but_not_current_execution(self):
        ids=lab.mature_training([True]*3,['2020-01-06','2020-01-07',None],np.ones(3),'2020-01-06',2)
        self.assertEqual(ids.tolist(),[0])
    def test_future_target_changes_cannot_alter_current_training(self):
        y=np.ones(5);dates=['2020-01-01','2020-01-08','2020-01-15','2020-01-22',None]
        before=lab.mature_training([True]*5,dates,y,'2020-01-14',4);y[2:]=1000
        after=lab.mature_training([True]*5,dates,y,'2020-01-14',4);self.assertEqual(before.tolist(),after.tolist());self.assertEqual(y[before].tolist(),[1,1])
    def test_missing_features_and_targets_stay_out(self):
        self.assertEqual(lab.mature_training([True,False,True],['2020-01-01']*3,np.array([1,1,np.nan]),'2020-01-02',3).tolist(),[0])
    def test_training_window_contains_only_last520_mature_starts(self):
        ids=lab.mature_training([True]*600,['2020-01-01']*600,np.ones(600),'2020-01-02',600)
        self.assertEqual((ids[0],ids[-1],len(ids)),(80,599,520))
    def test_constant_predictor_retransforms_to_arithmetic_variance(self):
        x=np.ones((104,3));y=np.linspace(.01,.09,104)
        pred,meta=lab.fit_predict(x,y,np.ones(3),['vix'])
        self.assertAlmostEqual(pred['vix'],y.mean());self.assertEqual(meta['models']['vix']['coefficients'],[0.])
    def test_forecast_bounds_are_explicit(self):
        x=np.ones((104,2))*20;y=np.ones(104)*.04
        pred,meta=lab.fit_predict(x,y,np.array([20.,20.]),['past13'])
        self.assertEqual(pred['past13'],1.);self.assertTrue(meta['models']['past13']['boundHit'])
    def test_zero_or_missing_target_rejected(self):
        with self.assertRaisesRegex(ValueError,'positive'):lab.fit_predict(np.ones((104,3)),np.zeros(104),np.ones(3),['vix'])
    def test_qlike_is_scale_invariant_and_zero_for_perfect_forecast(self):
        self.assertEqual(lab.qlike(.04,.04),0);self.assertAlmostEqual(lab.qlike(.08,.04),lab.qlike(.8,.4))
    def test_qlike_penalizes_confident_risk_underprediction(self):
        self.assertGreater(lab.qlike(.25,.01),lab.qlike(.25,.10))

class ForwardRecordTests(unittest.TestCase):
    def record(self):
        return {'id':'a','issuedAt':'2026-10-22T00:00:00+00:00','plannedStartDate':'2026-10-27','inputCutoff':'2026-10-19','outcomes':None,
            'horizons':{'4':{'lastTrainingMaturity':'2026-10-13','varianceForecasts':{str(i):.04 for i in range(6)}}}}
    def test_issue_after_target_start_rejected(self):
        import forward
        r=self.record();r['issuedAt']='2026-10-28T00:00:00+00:00'
        with self.assertRaisesRegex(ValueError,'after'):forward.validate(r)
    def test_issued_record_cannot_be_replaced(self):
        import forward
        r=self.record();ledger=forward.append({'records':[]},r);changed={**r,'inputCutoff':'2026-10-18'}
        with self.assertRaisesRegex(ValueError,'immutable'):forward.append(ledger,changed)
    def test_later_input_mutation_does_not_change_issued_record(self):
        import forward
        r=self.record();ledger=forward.append({'records':[]},r);r['inputCutoff']='2026-10-18'
        self.assertEqual(ledger['records'][0]['inputCutoff'],'2026-10-19')
    def test_future_outcome_cannot_be_injected_into_issuance(self):
        import forward
        r=self.record();r['outcomes']=.1
        with self.assertRaisesRegex(ValueError,'outcome'):forward.validate(r)

if __name__=='__main__':unittest.main()
