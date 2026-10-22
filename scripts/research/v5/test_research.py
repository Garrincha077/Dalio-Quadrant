import unittest
from unittest.mock import patch
import build
import archive

class EventTests(unittest.TestCase):
    def rows(self,values):
        out=[]
        for i,v in enumerate(values):
            week=str((build.pd.Timestamp('2020-01-03')+build.pd.Timedelta(weeks=i)).date())
            out.append({'week':week,'priceDate':week,'executionDate':week,'cutoff':week,'rsi':30 if v else 60,
                'vix':40,'hy':8,'level':2 if v else 0,'lower':2 if v else 0,'upper':2 if v else 0,
                'complete':v is not None,'context':{}})
        return out
    def test_left_censored_positive_excluded(self):
        self.assertEqual(build.new_episodes(self.rows([True,True]),lambda r:r['level']>=1,True),[])
    def test_repeated_weeks_do_not_create_entries(self):
        rows=self.rows([False,True,True,False,True]);entries=build.new_episodes(rows,lambda r:r['level']>=1,True)
        self.assertEqual([r['week'] for r in entries],[rows[1]['week'],rows[4]['week']])
    def test_missing_previous_does_not_create_entry(self):
        self.assertEqual(build.new_episodes(self.rows([False,None,True]),lambda r:r['level']>=1,True),[])
    def test_calendar_gap_censors_entry(self):
        rows=self.rows([False,False,True]);del rows[1]
        self.assertEqual(build.new_episodes(rows,lambda r:r['level']>=1,True),[])
    def test_prices_include_adverse_move_and_two_sided_fees(self):
        prices=[{'date':str(i),'adjusted':v} for i,v in enumerate([100,80,110])]
        r=build.outcome(0,prices,2)
        self.assertAlmostEqual(r['mae'],-.2);self.assertAlmostEqual(r['netReturn'],1.1*.999**2-1)
        self.assertAlmostEqual(r['stressReturn'],1.1*.9975**2-1)
    def test_no_mature_result_is_null(self):
        self.assertIsNone(build.outcome(0,[{'adjusted':100}],1))
        self.assertIsNone(build.stats([])['meanNetReturn']);self.assertEqual(build.stats([])['n'],0)
    def test_cooldown_keeps_first_entry_and_retains_all_skipped_rows(self):
        prices=[{'date':str(i),'adjusted':100+i} for i in range(10)]
        result=build.event_sample([{'executionDate':str(i)} for i in [0,1,2,3,9]],prices,3)
        self.assertEqual([r['status'] for r in result['entries']],['included','overlap skipped','overlap skipped','included','not yet mature'])
    def test_costs_on_flat_prices_are_negative(self):
        self.assertLess(build.outcome(0,[{'date':'a','adjusted':100},{'date':'b','adjusted':100}],1)['netReturn'],0)
    def test_archive_rejects_different_blob_before_values_are_used(self):
        with self.assertRaisesRegex(ValueError,'blob'):archive.validate(b'date,BAMLH0A0HYM2\n2008-01-01,8\n',{},'2026-10-21')
    def reconcile(self,official=4.5,archive_value=4.5):
        dates=[str((build.pd.Timestamp('2020-01-01')+build.pd.Timedelta(days=i)).date()) for i in range(100)]
        raw=('date,BAMLH0A0HYM2\n'+''.join(f'{d},{archive_value}\n' for d in dates)).encode()
        import hashlib
        blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        with patch.object(archive,'BLOB',blob),patch.object(build,'original',return_value=official):
            return archive.validate(raw,{},'2026-10-21')
    def test_reconciliation_rejects_threshold_crossing_even_with_small_difference(self):
        with self.assertRaisesRegex(ValueError,'reconciliation'):self.reconcile(4.499,4.501)
    def test_reconciliation_accepts_100_exact_matches(self):
        values,receipt=self.reconcile();self.assertEqual(receipt['matched'],100)
        self.assertEqual(receipt['thresholdCrossings'],0);self.assertEqual(receipt['maxAbsoluteDifferencePercentagePoints'],0)
    def test_reconciliation_rejects_non_crossing_large_difference(self):
        with self.assertRaisesRegex(ValueError,'reconciliation'):self.reconcile(3,3.03)

if __name__=='__main__':unittest.main()
