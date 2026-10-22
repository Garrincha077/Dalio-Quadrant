import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('guard_test_engine',Path(__file__).with_name('experiment.py'));lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
class GuardTests(unittest.TestCase):
    def test_guard_never_increases_baseline_exposure(self):
        for variance in [.0001,.01,.04,.25,1.]:
            for vol in [.01,.1,.2,.5,1.]:
                w=lab.guard_weight(variance,vol);self.assertGreaterEqual(w,0);self.assertLessEqual(w,min(1.,.1/vol))
    def test_high_forecast_risk_reduces_weight(self):
        self.assertAlmostEqual(lab.guard_weight(.16,.1),.25)
    def test_low_forecast_cannot_override_raw_risk_floor(self):
        self.assertAlmostEqual(lab.guard_weight(.01,.5),.2)
    def test_missing_or_zero_risk_has_no_position(self):
        for v in [None,0,-1,float('nan')]:self.assertEqual(lab.guard_weight(v,.2),0)
    def test_guard_has_no_leverage(self):
        self.assertEqual(lab.guard_weight(.0001,.01),1.)
if __name__=='__main__':unittest.main()
