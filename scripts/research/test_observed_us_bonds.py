import copy
import unittest
import numpy as np
import pandas as pd
from observed_us_bonds import sleeve_risk,reference_at,masks_at,outcome,point,diagnostic


def issuer(weights=None,durations=None,yields=None):
    values={'holdingPercent':weights or [50.,51.5,-1.5], 'assetClass':['Fixed Income','Fixed Income','Cash'],
            'cusip':['912000001','912000002',None],'duration':durations or [6.,8.,0.],
            'yieldToMaturity':yields or [4.,5.,0.], 'asOfDate':20241231}
    fields={k:{'value':v} for k,v in values.items()}
    return {'productId':239456,'componentsByNameMap':{'holdings':{'containersByNameMap':{'all':{'dataPointsByNameMap':fields}}}}}


class ObservedUSBondTests(unittest.TestCase):
    def history(self):
        return {m:{'cushion':i/100+1,'ytm':4.,'duration':7.,'date':str(m.end_time.date()),'month':str(m)}
                for i,m in enumerate(pd.period_range('2000-01',periods=90,freq='M'))}

    def test_ignored_asof_and_wrong_fund_are_rejected(self):
        with self.assertRaisesRegex(ValueError,'as-of'):sleeve_risk(issuer(),'2014-12-31')
        raw=issuer();raw['productId']=123
        with self.assertRaisesRegex(ValueError,'fund'):sleeve_risk(raw,'2024-12-31')

    def test_negative_cash_does_not_invalidate_normalized_treasury_sleeve(self):
        r=sleeve_risk(issuer(),'2024-12-31')
        self.assertAlmostEqual(r['netReportedWeight'],100.)
        self.assertAlmostEqual(r['treasuryWeight'],101.5)
        self.assertAlmostEqual(r['ytm'],(50*4+51.5*5)/101.5)
        self.assertAlmostEqual(r['duration'],(50*6+51.5*8)/101.5)

    def test_missing_risk_is_not_imputed_or_silently_reweighted_beyond_gate(self):
        raw=issuer();raw['componentsByNameMap']['holdings']['containersByNameMap']['all']['dataPointsByNameMap']['duration']['value'][0]=None
        with self.assertRaisesRegex(ValueError,'one percent'):sleeve_risk(raw,'2024-12-31')

    def test_aligned_security_fields_and_treasury_exposure_are_required(self):
        raw=issuer();raw['componentsByNameMap']['holdings']['containersByNameMap']['all']['dataPointsByNameMap']['cusip']['value'].pop()
        with self.assertRaisesRegex(ValueError,'Misaligned'):sleeve_risk(raw,'2024-12-31')
        raw=issuer();raw['componentsByNameMap']['holdings']['containersByNameMap']['all']['dataPointsByNameMap']['cusip']['value'][0]='CORPORATE'
        with self.assertRaisesRegex(ValueError,'Treasury exposure'):sleeve_risk(raw,'2024-12-31')

    def test_reference_excludes_current_and_future_risk_values(self):
        history=self.history();entry=pd.Period('2006-01',freq='M');r=reference_at(history,entry,'complete60')
        current=entry-2;expected=np.median([history[m]['cushion'] for m in pd.period_range(current-60,current-1,freq='M')])
        self.assertEqual(r['medianCushion'],expected)
        changed=copy.deepcopy(history)
        for m in changed:
            if m>=current:changed[m]['cushion']+=99
        self.assertEqual(reference_at(changed,entry,'complete60')['medianCushion'],expected)

    def test_complete_primary_rejects_holes_and_sensitivity_uses_observed_only(self):
        history=self.history();entry=pd.Period('2006-01',freq='M')
        for m in pd.period_range('2004-01',periods=6,freq='M'):history.pop(m)
        self.assertIsNone(reference_at(history,entry,'complete60'))
        r=reference_at(history,entry,'observed48');self.assertEqual(r['referenceCount'],54);self.assertEqual(r['referenceMaxGap'],6)
        history.pop(pd.Period('2004-07',freq='M'));self.assertIsNone(reference_at(history,entry,'observed48'))

    def test_missing_current_or_truncated_pre_source_window_withholds_signal(self):
        history=self.history();entry=pd.Period('2003-01',freq='M')
        self.assertIsNone(reference_at(history,entry,'observed48'))
        entry=pd.Period('2006-01',freq='M');history.pop(entry-2)
        self.assertIsNone(reference_at(history,entry,'complete60'))

    def test_rules_are_fixed_nested_masks_and_anchor_noise_is_not_weakness(self):
        risk={'cushion':.6,'medianCushion':.5}
        self.assertEqual(masks_at(risk,[-.1,2.,0.,-.3]),{'carry':True,'disinflation':True,'weak':True})
        self.assertFalse(masks_at(risk,[-1e-12,2.,0.,-.3])['weak'])
        self.assertFalse(masks_at(risk,[-.1,2.,0.,-.2])['disinflation'])
        self.assertFalse(masks_at({'cushion':.5,'medianCushion':.5},[-1,2,0,-1])['carry'])

    def test_carry_cushion_units_and_future_diagnostic_are_separate_from_signals(self):
        risk={'cushion':4./8,'medianCushion':.4};signal=masks_at(risk,[-.1,2,0,-.3])
        row={'horizon':12,'entry':'2020-01','exit':'2021-01','actual':0.}
        start={'date':'2020-01-31','ytm':4.,'duration':8.};end={'date':'2021-01-29','ytm':4.5,'duration':7.}
        d=diagnostic(row,{pd.Period('2020-01',freq='M'):start,pd.Period('2021-01',freq='M'):end})
        self.assertAlmostEqual(d['approximateReturn'],0.)
        self.assertEqual(signal,masks_at(risk,[-.1,2,0,-.3]))
        self.assertIsNone(diagnostic({**row,'horizon':3},{}))

    def test_costs_are_charged_once_and_absent_prices_are_not_bridged(self):
        p=pd.Series([100.,110.],index=pd.period_range('2020-01',periods=2,freq='M'))
        self.assertAlmostEqual(outcome(p,p.index[0],1),1.1*.999/1.001-1)
        self.assertIsNone(outcome(p,p.index[0],3))

    def test_empty_selection_is_unavailable_and_episodes_respect_calendar_gaps(self):
        self.assertIsNone(point([],'carry')['lift'])
        rows=[{'entry':m,'actual':.1,'horizon':12,'policies':{'carry':{'enter':True}}} for m in ['2020-01','2020-03']]
        result=point(rows,'carry');self.assertEqual(result['episodes'],2);self.assertEqual(result['lift'],0)


if __name__=='__main__':unittest.main()
