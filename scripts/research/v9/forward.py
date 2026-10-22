"""Record all twelve annual forecasts before one shared future outcome."""
import datetime as dt
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent

def validate(record):
    issued=dt.datetime.fromisoformat(record['issuedAt']);start=dt.datetime.fromisoformat(record['plannedStartDate']).replace(tzinfo=dt.timezone.utc)
    if issued>=start:raise ValueError('Forward issue must precede its target')
    if record['inputCutoff']>record['issuedAt'][:10] or record['outcomes'] is not None:raise ValueError('Future input or invented outcome')
    expected={'main':{'mean','market','stress'},'price':{'mean','market','stress','price'},'context':{'mean','market','stress','price','full'}}
    if set(record['cohorts'])!=set(expected) or record['sharedOutcomeCount']!=1:raise ValueError('All cohorts must share one annual target')
    for name,c in record['cohorts'].items():
        if set(c['forecasts'])!=expected[name]:raise ValueError('Every model/cohort must remain visible')
        if c['lastTrainingMaturity']>record['inputCutoff']:raise ValueError('Unknown training labels')
        if any(not -.5<=x<=.5 for x in c['forecasts'].values()):raise ValueError('Invalid annual estimate')
    return True

def freeze():
    path=ROOT/'data/return-forward-ledger.json'
    if path.exists():
        old=json.loads(path.read_text())
        for r in old['records']:validate(r)
        print(json.dumps({'status':'Issued annual records retained unchanged','records':len(old['records'])}));return old
    data=json.loads((ROOT/'data/return-research.json').read_text());fits=json.loads((ROOT/'work/research-v9/private-fits.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    r={'id':'annual-return-v9-2026-10-27','issuedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'basis':'prospective-lagged-annual-return-pilot',
        'inputWeek':'2026-10-16','inputCutoff':'2026-10-19','plannedStartDate':'2026-10-27','plannedEndDate':'2027-10-26','outcomes':None,
        'sharedOutcomeCount':1,'timingCaveat':'Reuses older completed-week inputs for a target one weekly execution later than the retrospective schedule; all twelve estimates share one future annual outcome.',
        'researchSha256':sha(ROOT/'data/return-research.json'),'protocolSha256':sha(HERE/'forward-protocol.md'),'cohorts':{}}
    for cohort,s in data['cohorts'].items():
        row=s['forecasts'][-1];f=fits[cohort][-1]
        r['cohorts'][cohort]={'forecasts':row['predictions'],'trainingCount':row['trainingCount'],'lastTrainingMaturity':row['lastTrainingMaturity'],
            'frozenModel':{k:f[k] for k in ['currentFeatures','means','sds','intercept','models']}}
    validate(r);ledger={'version':'annual-return-forward-ledger-1','records':[r]};path.write_text(json.dumps(ledger,separators=(',',':')));print(json.dumps({'issuedAt':r['issuedAt'],'start':r['plannedStartDate'],'end':r['plannedEndDate'],'forecasts':12,'sharedOutcomes':1}));return ledger
if __name__=='__main__':freeze()
