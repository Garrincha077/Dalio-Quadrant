import unittest
import experiment as lab

class RecoveryTests(unittest.TestCase):
    def clock(self,n=30):
        return [{'i':i,'week':str((lab.pd.Timestamp('2020-01-03')+lab.pd.Timedelta(weeks=i)).date()),'executionDate':str(i),
            'setup':i==0,'gap10':-1,'stressImproving':False,'priceZ':None,'valueZ':None,'growth':None,'inflation':None} for i in range(n)]
    def test_waits_for_confirmation_without_looking_ahead(self):
        rows=self.clock();rows[5]['stressImproving']=True;rows[5]['gap10']=1
        r=lab.confirmations(rows,0,'recovery')[0];self.assertEqual(r['delayWeeks'],5);self.assertEqual(r['confirmationIndex'],5)
        self.assertEqual(lab.confirmations(rows[:5],0,'recovery')[0]['status'],'pending')
    def test_deadline_includes_week26(self):
        rows=self.clock();rows[26]['stressImproving']=True
        self.assertEqual(lab.confirmations(rows,0,'stress')[0]['confirmationIndex'],26)
    def test_week27_is_too_late(self):
        rows=self.clock();rows[27]['stressImproving']=True
        self.assertEqual(lab.confirmations(rows,0,'stress')[0]['status'],'expired')
    def test_merged_setup_does_not_extend_deadline(self):
        rows=self.clock();rows[20]['setup']=True;rows[27]['stressImproving']=True
        records=lab.confirmations(rows,0,'stress');self.assertEqual([r['status'] for r in records],['expired','merged'])
        self.assertEqual(records[1]['mergedInto'],records[0]['setupWeek'])
    def test_value_and_price_filter_signs_differ(self):
        r=self.clock(1)[0];r.update(gap10=1,stressImproving=True,priceZ=-1,valueZ=1)
        self.assertTrue(lab.condition('price-z',r));self.assertTrue(lab.condition('value',r))
        r.update(priceZ=1,valueZ=-1);self.assertFalse(lab.condition('price-z',r));self.assertFalse(lab.condition('value',r))
    def test_missing_filter_does_not_pass(self):
        r=self.clock(1)[0];r.update(gap10=1,stressImproving=True)
        for name in ['price-z','value','macro']:self.assertFalse(lab.condition(name,r))
    def test_macro_needs_both_signs(self):
        r=self.clock(1)[0];r.update(gap10=1,stressImproving=True,growth=.1,inflation=-.1)
        self.assertTrue(lab.condition('macro',r));r['inflation']=.1;self.assertFalse(lab.condition('macro',r))
    def test_self_financing_buy_reaches_postfee_target(self):
        q,cost=lab.trade(.2,.8,.001)
        self.assertAlmostEqual(.2+q,.8*(1-cost));self.assertAlmostEqual(.8-q-cost,.2*(1-cost))
    def test_self_financing_sell_reaches_postfee_target(self):
        q,cost=lab.trade(.8,.2,.0025)
        self.assertAlmostEqual(.8-q,.2*(1-cost));self.assertAlmostEqual(.2+q-cost,.8*(1-cost))
    def test_no_trade_has_no_cost(self):
        self.assertEqual(lab.trade(.7,.7,.001),(0.,0.))
    def test_context_is_latest_known_with_age_limit(self):
        rows=[{'cutoff':'2020-01-01'},{'cutoff':'2020-02-01'}]
        self.assertEqual(lab.known(rows,'2020-01-31'),rows[0]);self.assertIsNone(lab.known(rows,'2020-04-15'))
    def test_economic_gates_do_not_promote_higher_risk_or_worse_drawdown(self):
        b={'cagr':.08,'volatility':.1,'maxDrawdown':-.2,'sharpe':.5}
        a={**b,'cagr':.09,'volatility':.12};self.assertFalse(lab.gates(a,b)['higherReturn'])
        a={**b,'cagr':.09,'maxDrawdown':-.21};self.assertFalse(lab.gates(a,b)['higherReturn'])

if __name__=='__main__':unittest.main()
