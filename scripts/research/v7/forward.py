"""Freeze a genuinely future pilot, with disclosed lag and all reference models."""
from copy import deepcopy
import datetime as dt
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent

def validate(record):
    issued=dt.datetime.fromisoformat(record['issuedAt'].replace('Z','+00:00'))
    start=dt.datetime.fromisoformat(record['plannedStartDate']).replace(tzinfo=dt.timezone.utc)
    if issued>=start:raise ValueError('Cannot issue a prospective record after its target starts')
    if record['inputCutoff']>record['issuedAt'][:10]:raise ValueError('Future input cutoff')
    if record['outcomes'] is not None:raise ValueError('Issuance cannot contain an outcome')
    for r in record['horizons'].values():
        if r['lastTrainingMaturity']>record['inputCutoff']:raise ValueError('Unknown training outcomes')
        if len(r['varianceForecasts'])!=6 or any(not .0001<=x<=1 for x in r['varianceForecasts'].values()):raise ValueError('Incomplete or invalid forecast set')
    return True

def append(ledger,record):
    validate(record)
    old=next((r for r in ledger['records'] if r['id']==record['id']),None)
    if old:
        if old!=record:raise ValueError('Issued forward record is immutable')
        return deepcopy(ledger)
    return deepcopy({**ledger,'records':[*ledger['records'],record]})

def freeze():
    path=ROOT/'data/risk-forward-ledger.json'
    if path.exists():
        old=json.loads(path.read_text())
        if any(r['id']=='risk-v7-2026-10-27' for r in old['records']):
            for r in old['records']:validate(r)
            print(json.dumps({'status':'Existing issued record retained unchanged','records':len(old['records'])}));return old
    data=json.loads((ROOT/'data/risk-research.json').read_text());fits=json.loads((ROOT/'work/research-v7/private-fits.json').read_text())
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    record={'id':'risk-v7-2026-10-27','issuedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'basis':'prospective-lagged-input-pilot',
        'inputWeek':'2026-10-16','inputCutoff':'2026-10-19','plannedStartDate':'2026-10-27','outcomes':None,
        'timingCaveat':'Reuses the last completed-week forecast with a target one weekly execution later than the retrospective schedule; older inputs, genuine future issuance.',
        'researchSha256':sha(ROOT/'data/risk-research.json'),'protocolSha256':sha(HERE/'forward-protocol.md'),'horizons':{}}
    for h,end in [('4','2026-11-24'),('52','2027-10-26')]:
        row=data['horizons'][h]['main']['forecasts'][-1];fit=fits[h]['main'][-1]
        record['horizons'][h]={'plannedEndDate':end,'varianceForecasts':row['predictions'],'trainingCount':row['trainingCount'],
            'lastTrainingMaturity':row['lastTrainingMaturity'],'frozenTransforms':{k:fit[k] for k in ['means','sds','models']}}
    validate(record);ledger={'version':'risk-forward-ledger-1','records':[]};ledger=append(ledger,record)
    path.write_text(json.dumps(ledger,separators=(',',':')))
    print(json.dumps({'status':'Prospective pilot frozen','issuedAt':record['issuedAt'],'start':record['plannedStartDate'],'records':1,'outcomes':None}))
    return ledger
if __name__=='__main__':freeze()
