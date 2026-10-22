import importlib.util,unittest
from pathlib import Path
import numpy as np
import pandas as pd
spec=importlib.util.spec_from_file_location('shock_test_lab',Path(__file__).with_name('experiment.py'));lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
class ShockTests(unittest.TestCase):
 def calendar(self,n=200):
  return [{'week':str((pd.Timestamp('2008-01-04')+pd.Timedelta(weeks=i)).date()),'executionDate':str((pd.Timestamp('2008-01-08')+pd.Timedelta(weeks=i)).date()),'cutoff':str((pd.Timestamp('2008-01-07')+pd.Timedelta(weeks=i)).date()),'complete':True,'level':0,'rsi':50,'vix':20,'hy':4} for i in range(n)]
 def test_static_state_is_separate_from_direction(self):
  self.assertEqual(lab.quadrant(-1,-.5),'G-/I-');self.assertEqual(lab.direction(0,.2),'G0/I+');self.assertEqual(lab.quadrant(None,1),'missing')
 def test_z_bins_have_fixed_inclusive_boundaries(self):
  self.assertEqual([lab.zbin(z) for z in [-1.01,-1,0,1,None]],['<-1','-1 to 0','0 to 1','>=1','missing'])
 def test_short_z_excludes_current_price_from_reference(self):
  p=np.exp(np.linspace(0,1,253));expected=(np.log(p[252])-np.log(p[:252]).mean())/np.log(p[:252]).std(ddof=1);self.assertAlmostEqual(lab.short_z(p,252),expected);self.assertIsNone(lab.short_z(p,251));self.assertIsNone(lab.short_z(np.ones(253),252))
 def test_future_l3_cannot_relabel_earlier_l1(self):
  c=self.calendar();c[0]['level']=1;c[5]['level']=3;r=lab.build_calendar(c,[],[]);self.assertEqual(r[0]['memory'],'none');self.assertFalse(r[0]['firstL3']);self.assertEqual(r[5]['memory'],'0–4');self.assertEqual(r[10]['memory'],'5–13')
 def test_l3_repeats_in_same_cluster_do_not_reset_clock(self):
  c=self.calendar();c[1]['level']=3;c[10]['level']=3;r=lab.build_calendar(c,[],[]);self.assertEqual(sum(x['firstL3'] for x in r),1);self.assertEqual(r[10]['weeksSinceL3'],9);self.assertEqual(r[158]['memory'],'none')
 def test_genuinely_new_l3_cluster_resets_clock(self):
  c=self.calendar();c[1]['level']=3;c[60]['level']=3;r=lab.build_calendar(c,[],[]);self.assertEqual(sum(x['firstL3'] for x in r),2);self.assertEqual(r[60]['weeksSinceL3'],0);self.assertNotEqual(r[1]['l3Cluster'],r[60]['l3Cluster'])
 def test_missing_dashboard_history_stays_missing(self):
  r=lab.build_calendar(self.calendar(2),[],[]);self.assertTrue(all(x['dashboard']=='missing' and x['growthMomentum'] is None for x in r))
 def test_event_uses_exact_dates_both_fees_actual_cash_and_daily_adverse_path(self):
  c=[{'complete':True,'executionDate':'2020-01-07','cashReturn':.001},{'complete':True,'executionDate':'2020-01-14','cashReturn':None}];p=[{'date':'2020-01-07','adjusted':100},{'date':'2020-01-10','adjusted':60},{'date':'2020-01-14','adjusted':120}];r=lab.event(p,c,0,1);self.assertAlmostEqual(r[0],1.2*.999/1.001-1);self.assertAlmostEqual(r[2],.001);self.assertAlmostEqual(r[4],-.4);self.assertIsNone(lab.event(p[:-1],c,0,1));self.assertIsNone(lab.event(p,c,1,1))
 def test_horizon_spaced_starts_are_first_in_time_not_best_returns(self):
  c=[{'cluster':None,'l3Cluster':None,'level':0} for _ in range(6)];events=[[v,v,0,v,-.1,v] for v in [.1,.9,.2,.3,.4,.5]];s=lab.summary([0,1,4],events,c,3,.3);self.assertEqual(s[1],2);self.assertAlmostEqual(s[13],.25)
if __name__=='__main__':unittest.main()
