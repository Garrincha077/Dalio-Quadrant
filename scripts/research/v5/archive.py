"""Validated immutable user archive; keeps both original studies unchanged."""
import csv
import hashlib
import io
import json
from copy import deepcopy
from datetime import date
import requests
import build

ROOT,WORK,HERE=build.ROOT,build.WORK,build.HERE
REF='bf64e83fa4c2a6e72c37d3883476dc81bd9d2e31'
BLOB='fee6be14d5322d7402826f1ea2d03de5a475ac0d'
URL=f'https://github.com/maaurocp/Trading_Protocol/blob/{REF}/data/raw/fred_BAMLH0A0HYM2.csv'

def validate(raw,reference,as_of):
    blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if blob!=BLOB:raise ValueError('Archive blob identity differs')
    reader=csv.DictReader(io.StringIO(raw.decode()))
    if reader.fieldnames!=['date','BAMLH0A0HYM2']:raise ValueError('Unexpected archive schema')
    values={};last='';blanks=0
    for row in reader:
        d=row['date'];date.fromisoformat(d)
        if d<=last or d>'2026-02-11':raise ValueError('Archive dates unsorted, duplicated or future')
        last=d;v=float(row['BAMLH0A0HYM2']) if row['BAMLH0A0HYM2'].strip() else None
        if v is not None and (not build.np.isfinite(v) or v<0):raise ValueError('Invalid archive value')
        blanks+=v is None;values[d]=v
    diffs=[];crossings=0;matched=[]
    for d,v in values.items():
        official=build.original(reference,as_of,d)
        if v is None or official is None:continue
        diffs.append(abs(v-official));matched.append(d)
        crossings+=sum((v>=t)!=(official>=t) for t in [4.5,6,8])
    if len(diffs)<100 or max(diffs)>.02 or crossings:raise ValueError('Archive reconciliation failed')
    return values,{'file':'work/research-v5/hy-user-archive.csv','url':URL,'repository':'maaurocp/Trading_Protocol',
        'commit':REF,'commitDate':'2026-02-11T20:22:22Z','gitBlob':blob,'sha256':hashlib.sha256(raw).hexdigest(),
        'bytes':len(raw),'first':min(values),'last':max(values),'rows':len(values),'nonmissing':len(values)-blanks,'blanks':blanks,
        'referenceAsOf':as_of,'matched':len(diffs),'overlapFirst':min(matched),'overlapLast':max(matched),
        'maxAbsoluteDifferencePercentagePoints':max(diffs),'thresholdCrossings':crossings,
        'status':'Verified immutable retrospective archive; original release vintages unavailable before 2023'}

def extend():
    path=WORK/'hy-user-archive.csv'
    if not path.exists():
        response=requests.get(f'https://raw.githubusercontent.com/maaurocp/Trading_Protocol/{REF}/data/raw/fred_BAMLH0A0HYM2.csv',timeout=45)
        response.raise_for_status();path.write_bytes(response.content)
    data=json.loads((WORK/'research-candidate.json').read_text())
    ref=json.loads((WORK/'fred/BAMLH0A0HYM2.json').read_text())
    values,receipt=validate(path.read_bytes(),ref,data['asOf'])
    (WORK/'original-candidate.json').write_text(json.dumps(data,separators=(',',':')))
    rows=deepcopy(data['weeks']);previous=None
    for row in rows:
        original=row['cutoff'] in ref['cutoffs']
        row['hy']=build.original(ref,row['cutoff'],row['priceDate']) if original else values.get(row['priceDate'])
        row['hySource']='FRED original vintage' if original else 'User-provided retrospective FRED archive'
        row.update(build.classify(row['rsi'],row['vix'],row['hy']))
        row['archiveEligible']=row['complete']
        row['newSignal']=bool(previous and previous['complete'] and row['complete'] and row['level']>previous['level'] and row['level']>0)
        previous=row
    prices=build.acquire.price_rows(json.loads((WORK/'spy-daily.json').read_text()),'SPY',data['asOf'])
    eligible=[r for r in rows if r['complete']]
    study={'label':'Three-input rule with verified retrospective HY archive','first':eligible[0]['week'],
        'last':eligible[-1]['week'],'eligibleWeeks':len(eligible),'rules':{},'unconditional':{}}
    predicates={'level1':lambda r:r['level']>=1,'level2':lambda r:r['level']>=2,'level3':lambda r:r['level']==3,
        'rsi':lambda r:r['rsi']<=40,'vix':lambda r:r['vix']>=25,'hy':lambda r:r['hy']>=4.5}
    for key,predicate in predicates.items():
        entries=build.new_episodes(rows,predicate,True)
        study['rules'][key]={'label':data['studies']['full']['rules'][key]['label'],'setupEpisodes':len(entries),
            'horizons':{str(h):build.event_sample(entries,prices,h) for h in build.HORIZONS}}
    for h in build.HORIZONS:study['unconditional'][str(h)]=build.event_sample(eligible,prices,h,False)['stats']
    data['studies']['archive']=study;data['archiveWeeks']=rows;data['archiveReceipt']=receipt
    data['archiveProtocolSha256']=build.acquire.sha(HERE/'archive-protocol.md');data['originalCandidateSha256']=build.acquire.sha(WORK/'original-candidate.json')
    data['sources'].append(receipt)
    data['limitations'].append('The extended three-input cohort uses a verified retrospective HY archive before original-vintage coverage. Overlap agreement does not prove historical publication-time availability.')
    (WORK/'archive-receipt.json').write_text(json.dumps(receipt,indent=2))
    (WORK/'research-candidate.json').write_text(json.dumps(build.safe(data),separators=(',',':'),allow_nan=False))
    print(json.dumps({'receipt':receipt,'coverage':[study['first'],study['last']],
        'results252':{k:v['horizons']['252']['stats'] for k,v in study['rules'].items()}}))
if __name__=='__main__':extend()
