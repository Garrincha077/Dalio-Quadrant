"""All shock/regime/asset cells, with causal inputs and exposed-history labels."""
import importlib.util,json
from pathlib import Path
import numpy as np
import pandas as pd
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];WORK=ROOT/'work/research-v10'
def module(name,p):
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
engine=module('shock_engine',HERE.parent/'v6/experiment.py');acq=module('shock_acq',HERE/'acquire.py')
ASSETS=acq.ASSETS;HORIZONS=[13,52,156,260]
ASSET_NAMES={'SPY':'US equities','IEF':'Nominal Treasuries','GLD':'Gold','TIP':'Inflation-linked Treasuries','DBC':'Commodity futures'}
ASSET_COLUMNS=['priceZ','valueZ','priceZ20','valueZ20','shortZ','return13','return52','vol52','gap10','gap40']
SUMMARY_COLUMNS=['n','spacedN','stressClusters','l3Clusters','calendarBlocks','meanAnnual','medianAnnual','meanNet','medianNet','positiveShare','meanExcessAnnual','worstMAE','p10Annual','spacedMeanAnnual','spacedMedianAnnual','spacedWorstMAE','topDecileShare']
EVENT_COLUMNS=['net','annual','cash','excessAnnual','mae','stressNet']
FAMILIES={'level':(['level'],'Exact stress level'), 'level-static':(['level','static'],'Level × static state'), 'level-impulse':(['level','impulse'],'Level × 3M released-state impulse'), 'level-dashboard':(['level','dashboard'],'Level × dashboard momentum'), 'level-price':(['level','priceBin'],'Level × canonical price z'), 'level-value':(['level','valueBin'],'Level × canonical value z'), 'level-short':(['level','shortBin'],'Level × one-year price z'), 'static-impulse':(['static','impulse'],'Static state × released-state impulse'), 'memory-static':(['memory','static'],'Time since first L3 × static state'), 'memory-recovery':(['memory','recovery'],'Time since first L3 × stress improvement'), 'level-static-impulse':(['level','static','impulse'],'Level × static × released-state impulse'), 'level-static-short':(['level','static','shortBin'],'Level × static × one-year price z')}
NUMERIC=['activity','inflationGap','growthImpulse','inflationImpulse','growthMomentum','inflationMomentum','rsi','vix','hy','vixChange4','hyChange4','weeksSinceL3']+ASSET_COLUMNS

def quadrant(a,b):
 if a is None or b is None or not np.isfinite(a) or not np.isfinite(b):return 'missing'
 return ('G+' if a>=0 else 'G-')+'/'+('I+' if b>=0 else 'I-')
def direction(a,b):
 if a is None or b is None or not np.isfinite(a) or not np.isfinite(b):return 'missing'
 sign=lambda x:'+' if x>0 else '-' if x<0 else '0'
 return 'G'+sign(a)+'/I'+sign(b)
def zbin(z):
 if z is None or not np.isfinite(z):return 'missing'
 return '<-1' if z< -1 else '-1 to 0' if z<0 else '0 to 1' if z<1 else '>=1'
def short_z(closes,j):
 if j<252:return None
 x=np.log(np.asarray(closes[j-252:j],float));s=x.std(ddof=1)
 return float((np.log(closes[j])-x.mean())/s) if s>1e-12 else None

def build_calendar(cal,macro,scores):
 bymonth={r['tradeDate'][:7]:r for r in macro};out=[];laststress=None;cluster=-1;firstl3={};lastl3=None;l3cluster=None
 for i,r in enumerate(cal):
  m=engine.known(macro,r['cutoff']);s=engine.known(scores,r['cutoff']);prev=bymonth.get(str(pd.Period(m['tradeDate'],freq='M')-3)) if m else None
  activity=m['activity'] if m else None;inf=m['inflationGap'] if m else None
  dg=activity-prev['activity'] if prev and activity is not None and prev['activity'] is not None else None
  di=inf-prev['inflationGap'] if prev and inf is not None and prev['inflationGap'] is not None else None
  if r['complete'] and r['level']>0:
   if laststress is None or i-laststress>26:cluster+=1
   laststress=i
   if r['level']==3 and cluster not in firstl3:firstl3[cluster]=i;lastl3=i;l3cluster=cluster
  since=i-lastl3 if lastl3 is not None else None
  memory='none' if since is None or since>156 else '0–4' if since<=4 else '5–13' if since<=13 else '14–26' if since<=26 else '27–52' if since<=52 else '53–104' if since<=104 else '105–156'
  before=cal[i-4] if i>=4 else None;dv=r['vix']/before['vix']-1 if before and r['vix'] and before['vix'] else None;dh=r['hy']-before['hy'] if before and r['hy'] is not None and before['hy'] is not None else None
  out.append({'i':i,'week':r['week'],'executionDate':r['executionDate'],'cutoff':r['cutoff'],'complete':r['complete'],'level':r['level'] if r['complete'] else None,
   'macroCutoff':m['cutoff'] if m else None,'scoreCutoff':s['cutoff'] if s else None,'activity':activity,'inflationGap':inf,'growthImpulse':dg,'inflationImpulse':di,'growthMomentum':m['growth'] if m else None,'inflationMomentum':m['inflation'] if m else None,
   'static':quadrant(activity,inf),'impulse':direction(dg,di),'dashboard':direction(m['growth'],m['inflation']) if m else 'missing',
   'cluster':cluster if laststress is not None and i-laststress<=26 else None,'l3Cluster':l3cluster if memory!='none' else None,'firstL3':i==lastl3,'weeksSinceL3':since if memory!='none' else None,'memory':memory,
   'rsi':r['rsi'],'vix':r['vix'],'hy':r['hy'],'vixChange4':dv,'hyChange4':dh,'recovery':'improving' if dv is not None and dh is not None and dv<0 and dh<0 else 'not improving' if dv is not None and dh is not None else 'missing'})
 return out

def asset_features(asset,rows,cal,scores):
 look={r['date']:j for j,r in enumerate(rows)};closes=np.array([r['close'] for r in rows]);weekly=[rows[look[r['priceDate']]] if r['priceDate'] in look else None for r in cal];out=[]
 for i,r in enumerate(cal):
  s=engine.known(scores,r['cutoff']);v=s['assets'][asset] if s else None;j=look.get(r['priceDate']);current=weekly[i]
  previous=weekly[max(0,i-52):i+1];complete=len(previous)==53 and all(p for p in previous)
  vol=float(np.std([previous[k]['adjusted']/previous[k-1]['adjusted']-1 for k in range(1,53)],ddof=1)*np.sqrt(52)) if complete else None
  momentum=lambda h:current['adjusted']/weekly[i-h]['adjusted']-1 if current and i>=h and weekly[i-h] else None
  trend=lambda h:current['close']/np.mean([p['close'] for p in weekly[i-h+1:i+1]])-1 if current and i>=h-1 and all(weekly[i-h+1:i+1]) else None
  out.append([v['price']['z'] if v else None,v['value']['z'] if v else None,v['price'].get('z20') if v else None,v['value'].get('z20') if v else None,short_z(closes,j) if j is not None else None,momentum(13),momentum(52),vol,trend(10),trend(40)])
 return out

def event(rows,cal,i,h,lookup=None):
 if i+h>=len(cal) or not cal[i]['complete']:return None
 look=lookup if lookup is not None else {r['date']:j for j,r in enumerate(rows)};a=look.get(cal[i]['executionDate']);b=look.get(cal[i+h]['executionDate'])
 if a is None or b is None:return None
 ratio=rows[b]['adjusted']/rows[a]['adjusted'];net=ratio*.999/1.001-1;stress=ratio*.9975/1.0025-1;days=(pd.Timestamp(cal[i+h]['executionDate'])-pd.Timestamp(cal[i]['executionDate'])).days;cash=float(np.prod([1+r['cashReturn'] for r in cal[i:i+h]])-1)
 annual=(1+net)**(365.25/days)-1;ca=(1+cash)**(365.25/days)-1;mae=min(r['adjusted'] for r in rows[a:b+1])/rows[a]['adjusted']-1
 return [net,annual,cash,annual-ca,mae,stress]

def summary(ix,events,cal,h,threshold):
 if not ix:return None
 arr=np.array([events[i] for i in ix]);spaced=[];last=-10**9
 for i in ix:
  if i-last>=h:spaced.append(i);last=i
 a=np.array([events[i] for i in spaced]);clusters={cal[i]['cluster'] for i in ix if cal[i]['cluster'] is not None};l3={cal[i]['l3Cluster'] for i in ix if cal[i]['level']==3 and cal[i]['l3Cluster'] is not None}
 return [len(ix),len(spaced),len(clusters),len(l3),len({i//h for i in ix}),float(arr[:,1].mean()),float(np.median(arr[:,1])),float(arr[:,0].mean()),float(np.median(arr[:,0])),float(np.mean(arr[:,0]>0)),float(arr[:,3].mean()),float(arr[:,4].min()),float(np.quantile(arr[:,1],.1)),float(a[:,1].mean()),float(np.median(a[:,1])),float(a[:,4].min()),float(np.mean(arr[:,1]>=threshold))]

def tables(events,cal,features,h):
 valid=[i for i,e in enumerate(events) if e is not None];threshold=float(np.quantile([events[i][1] for i in valid],.9));result={}
 for family,(fields,_) in FAMILIES.items():
  groups={}
  for i in valid:
   f=dict(zip(ASSET_COLUMNS,features[i]));r=dict(cal[i],priceBin=zbin(f['priceZ']),valueBin=zbin(f['valueZ']),shortBin=zbin(f['shortZ']));key='|'.join(str(r[k]) for k in fields);groups.setdefault(key,[]).append(i)
  result[family]={key:summary(ix,events,cal,h,threshold) for key,ix in sorted(groups.items())}
 top=[]
 for field in NUMERIC:
  ix=[i for i in valid if (v:=(dict(zip(ASSET_COLUMNS,features[i]))|cal[i]).get(field)) is not None and np.isfinite(v)]
  if not ix:top.append({'feature':field,'n':0});continue
  values=np.array([(dict(zip(ASSET_COLUMNS,features[i]))|cal[i])[field] for i in ix]);y=np.array([events[i][1] for i in ix]);cut=float(np.quantile(y,.9));mask=y>=cut;scale=values.std(ddof=1)
  top_ix=[i for k,i in enumerate(ix) if mask[k]];spaced=[]
  for i in top_ix:
   if not spaced or i-spaced[-1]>=h:spaced.append(i)
  top.append({'feature':field,'n':len(ix),'topN':int(mask.sum()),'topSpacedN':len(spaced),'topCalendarBlocks':len({i//h for i in top_ix}),'annualThreshold':cut,'topMedian':float(np.median(values[mask])),'otherMedian':float(np.median(values[~mask])),'standardizedDifference':float((values[mask].mean()-values[~mask].mean())/scale) if scale>1e-12 else None,'topMean':float(values[mask].mean()),'otherMean':float(values[~mask].mean()),'first':cal[ix[0]]['week']})
 best=[]
 for i in sorted(valid,key=lambda i:events[i][1],reverse=True):
  if all(abs(i-j)>=52 for j in best):best.append(i)
  if len(best)==5:break
 return {'summary':summary(valid,events,cal,h,threshold),'threshold90':threshold,'cells':result,'antecedents':top,'bestEntryExamples':best}

def compare(events,cal,starts):
 a=np.array([e[1] if e is not None else np.nan for e in events]);level=np.array([r['level'] if r['level'] is not None else -1 for r in cal]);n=len(cal);idx=((starts[:,:,None]+np.arange(156))%n).reshape(len(starts),-1)[:,:n];out=[]
 l3=(level==3)&np.isfinite(a);clusters=sorted({cal[i]['l3Cluster'] for i in np.flatnonzero(l3)})
 for ref in range(3):
  baseline=(level==ref)&np.isfinite(a);aa=np.where(l3,a,0);bb=np.where(baseline,a,0);na=l3[idx].sum(axis=1);nb=baseline[idx].sum(axis=1);ok=(na>0)&(nb>0)
  draws=aa[idx[ok]].sum(axis=1)/na[ok]-bb[idx[ok]].sum(axis=1)/nb[ok]
  diff=float(a[l3].mean()-a[baseline].mean());leave=[]
  for c in clusters:
   keep=l3&np.array([r['l3Cluster']!=c for r in cal]);leave.append({'omittedCluster':c,'remainingL3N':int(keep.sum()),'remainingL3MeanAnnual':float(a[keep].mean()) if keep.any() else None,'difference':float(a[keep].mean()-a[baseline].mean()) if keep.any() else None})
  out.append({'referenceLevel':ref,'l3N':int(l3.sum()),'referenceN':int(baseline.sum()),'l3Clusters':len(clusters),'difference':diff,'lower95':float(np.quantile(draws,.025)),'upper95':float(np.quantile(draws,.975)),'validDraws':len(draws),'p':None,'holmP':None,'inference':'Withheld: fewer than five L3 crisis clusters','leaveOneL3CrisisOut':leave})
 return out

def build():
 manifest=json.loads((WORK/'source-manifest.json').read_text());private=json.loads((ROOT/'work/research-v6/private-calendar.json').read_text());macro=json.loads((ROOT/'work/research-v2/features.json').read_text())['rows'];scores=json.loads((ROOT/'work/research-v3/features.json').read_text())['rows'];cal=build_calendar(private,macro,scores)
 rng=np.random.default_rng(20261022);starts=rng.integers(0,len(cal),size=(2500,int(np.ceil(len(cal)/156))))
 d={'version':'shock-asset-research-10','asOf':manifest['asOf'],'confirmedEdge':False,'primaryHorizon':156,'horizons':HORIZONS,'assets':ASSET_NAMES,'protocolSha256':engine.sha(HERE/'protocol.md'),'sources':manifest['prices'],'sourceHashes':{p:engine.sha(ROOT/p) for p in ['work/research-v2/features.json','work/research-v3/features.json','data/bottoming.json','data/recovery-research.json']},'calendar':cal,'assetColumns':ASSET_COLUMNS,'eventColumns':EVENT_COLUMNS,'summaryColumns':SUMMARY_COLUMNS,'families':{k:{'fields':v[0],'label':v[1]} for k,v in FAMILIES.items()},'studies':{},'assetFeatures':{},'primaryComparisons':{},'limitations':['All historical periods and earlier related research were inspected. This is exploratory, not a fresh holdout.','Ten L3 weeks represent only two L3 crisis clusters; no severity significance claim is permitted.','Overlapping starts, horizon-spaced starts and calendar blocks are descriptive counts, not independent observations.','Macro and canonical z inputs use the last stored monthly snapshot, at most 62 days old; this can lag weekly releases and current market prices. Missing pre-2011 dashboard momentum is not reconstructed with revisions.','Canonical price/value z and the separate exploratory one-year price z have different coverage and meanings.','Top-decile labels and local best-entry examples are selected after outcomes; antecedents are hypotheses, not live trading rules.','Returns are standalone net event outcomes, not continuous portfolio CAGR. MAE uses daily closes and excludes intraday losses.','Daily sources differ from older monthly snapshots at some historical dates; per-asset reconciliation status remains visible.']}
 for receipt in manifest['prices']:
  asset=receipt['symbol'];prices=acq.source.price_rows(json.loads((ROOT/receipt['file']).read_text()),asset,manifest['asOf']);features=asset_features(asset,prices,private,scores);d['assetFeatures'][asset]=features;d['studies'][asset]={}
  for h in HORIZONS:
   lookup={r['date']:j for j,r in enumerate(prices)};events=[event(prices,private,i,h,lookup) for i in range(len(cal))];study=tables(events,cal,features,h);study['events']=events;d['studies'][asset][h]=study
   if h==156:d['primaryComparisons'][asset]=compare(events,cal,starts)
  print(json.dumps({'asset':asset,'level36M':d['studies'][asset][156]['cells']['level'],'firstL3Cases':[{k:r[k] for k in ['week','static','impulse','dashboard']}|{'event':d['studies'][asset][156]['events'][r['i']]} for r in cal if r['firstL3']]}),flush=True)
 (WORK/'bootstrap-starts.json').write_text(json.dumps(starts.tolist(),separators=(',',':')));(WORK/'research-candidate.json').write_text(json.dumps(engine.safe(d),separators=(',',':'),allow_nan=False));return d
if __name__=='__main__':build()
