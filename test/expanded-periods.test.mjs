import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ratesModelScore,trainingRank,periodCoverage,periodDetails} from '../rates-entry-view.mjs';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url));
const data=JSON.parse(await read('data/expanded-periods.json'));
const old=JSON.parse(await read('data/rates-entry.json'));
const hash=async p=>createHash('sha256').update(await read(p)).digest('hex');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function records(panel,target,stage){const refs=new Map(target.refits.map(f=>[f.refitMonth.slice(0,4),f]));return target.forecasts.map(row=>{const m=panel.models[refs.get(row.entry.slice(0,4)).models[stage]],s=ratesModelScore(m,row.x);return {...row,enter:s>1e-12&&s>=m.threshold-1e-12};});}
function verifyPoint(rows,p){assert.equal(p.nScored,rows.length);const selected=rows.filter(r=>r.enter);assert.equal(p.selectedStarts,selected.length);if(selected.length){close(p.mean,mean(selected.map(r=>r.actual)));close(p.lift,p.mean-mean(rows.map(r=>r.actual)));}else assert.equal(p.lift,null);}

test('expanded study freezes the old recipe and identifies independent source histories',async()=>{
 assert.equal(data.builderSha256,await hash('scripts/research/expanded_periods.py'));
 assert.equal(data.preparationSha256,await hash('scripts/research/prepare_period_histories.py'));
 assert.equal(data.protocolSha256,await hash('scripts/research/expanded-periods-protocol.md'));
 assert.equal(data.previousStudySha256,await hash('data/rates-entry.json'));
 assert.equal(data.stateSourceSha256,await hash('data/state-forward.json'));
 for(const [p,h] of Object.entries(data.dependencies))assert.equal(h,await hash('scripts/research/'+p));
 assert.equal(data.panels.length,8);assert.equal(data.bootstrapDraws,5000);assert.equal(data.spyCrossCheck.months,321);
 for(const p of data.panels)for(const a of Object.values(p.assets)){assert.equal(a.pricesSha256.length,64);assert.ok(a.priceStart<a.priceEnd);}
});

test('per-asset periods expand both earlier and later without deleting the original scored dates',()=>{
 for(const p of data.panels)for(const t of p.targets){
  const before=old.panels.find(o=>o.panel===p.panel&&o.information===p.information&&o.cohort===p.cohort).targets.find(o=>o.asset===t.asset&&o.horizon===t.horizon),c=t.periodComparison;
  assert.ok(t.inputStart<=t.results.base.firstEntry);assert.ok(t.inputEnd>=t.results.base.lastExit);
  const newDates=new Set(t.forecasts.map(r=>r.entry));for(const r of before.forecasts)assert.ok(newDates.has(r.entry));
  assert.equal(c.previousScored,before.forecasts.length);assert.equal(c.expandedScored,t.forecasts.length);
  assert.equal(c.commonDates,before.forecasts.length);assert.equal(c.additionalScored,t.forecasts.length-before.forecasts.length);
  if(p.information==='vintage')assert.ok(t.forecasts[0].entry>='2012-01');
 }
 const long=data.panels.find(p=>p.panel==='long'&&p.information==='revised'&&p.cohort==='nominal');
 assert.equal(long.targets.find(t=>t.asset==='EQUITY'&&t.horizon===12).results.base.firstEntry,'1974-01');
 assert.equal(long.assets.GOLD.priceStart,'1973-01');
 const etf=data.panels.find(p=>p.panel==='etf'&&p.information==='vintage'&&p.cohort==='nominal');
 assert.equal(etf.targets.find(t=>t.asset==='IEF'&&t.horizon===12).results.base.firstEntry,'2012-01');
});

test('all stage results, exact-date comparisons and fixed-era summaries reconcile',()=>{
 for(const p of data.panels)for(const t of p.targets){
  const oldPanel=old.panels.find(o=>o.panel===p.panel&&o.information===p.information&&o.cohort===p.cohort),oldTarget=oldPanel.targets.find(o=>o.asset===t.asset&&o.horizon===t.horizon),c=t.periodComparison,avg={};
  for(const stage of data.stages){
   const rows=records(p,t,stage),before=records(oldPanel,oldTarget,stage),dates=new Set(before.map(r=>r.entry));
   verifyPoint(rows,t.results[stage]);avg[stage]=t.results[stage].mean;
   verifyPoint(rows.filter(r=>dates.has(r.entry)),c.commonExpanded[stage]);verifyPoint(before,c.commonOriginal[stage]);
   verifyPoint(rows.filter(r=>r.entry<c.previousFirst),c.earlierAdded[stage]);verifyPoint(rows.filter(r=>r.entry>c.previousLast),c.laterAdded[stage]);
   for(const e of t.eras)verifyPoint(rows.filter(r=>r.entry>=e.start&&r.entry<e.endExclusive),e.results[stage]);
  }
  for(const v of Object.values(t.incremental)){if(avg[v.left]===null||avg[v.right]===null)assert.equal(v.gain,null);else close(v.gain,avg[v.left]-avg[v.right]);}
 }
});

test('longer periods retain matured chronology and stage-specific fallback',()=>{
 for(const p of data.panels)for(const t of p.targets)for(const f of t.refits)for(const s of data.stages){
  const m=p.models[f.models[s]];assert.ok(m.n>=60);assert.ok(m.lastTrainingExit<m.refitMonth);
  if(f.fallback)assert.equal(m.spec.id,s+':100:0');else{
   assert.ok(f.lastValidationExit<f.refitMonth);
   const chosen=f.candidates.filter(c=>c.family===s&&c.entryStarts>=12&&c.entryEpisodes>=3&&c.entryLift>0).sort((a,b)=>b.entryLift-a.entryLift||(a.id<b.id?-1:a.id>b.id?1:0));
   assert.equal(m.spec.id,chosen[0]?.id??'unconditional');
  }
 }
});

test('expanded-study Holm family pools both availability cohorts and stage comparisons',()=>{
 for(const info of ['revised','vintage'])for(const name of ['long','etf']){
  const rows=data.panels.filter(p=>p.information===info&&p.panel===name).flatMap(p=>p.targets.flatMap(t=>[...Object.values(t.results),...Object.values(t.incremental)]));
  const eligible=rows.filter(r=>r.supported&&r.bootstrapP!=null).sort((a,b)=>a.bootstrapP-b.bootstrapP);let current=0;
  eligible.forEach((r,i)=>{current=Math.max(current,(eligible.length-i)*r.bootstrapP);close(r.holmP,Math.min(1,current));});
 }
});

test('every expanded CSV rank/decision reconciles with its dated model',async()=>{
 const csv=(await read('data/expanded-periods.csv')).toString().trimEnd().split('\n'),cols=csv.shift().split(','),models=new Map(data.panels.flatMap(p=>Object.entries(p.models)));
 assert.equal(csv.length,3*data.panels.reduce((n,p)=>n+p.targets.reduce((n,t)=>n+t.forecasts.length,0),0));
 for(const line of csv){const r=Object.fromEntries(line.split(',').map((v,i)=>[cols[i],v])),m=models.get(r.model),score=Number(r.score),rank=trainingRank(m,score);if(rank===null)assert.equal(r.trainingRank,'');else close(Number(r.trainingRank),rank);assert.equal(r.enter,score>1e-12&&score>=m.threshold-1e-12?'True':'False');}
});

test('UI distinguishes actual coverage, shared-date points and descriptive eras',()=>{
 const p=data.panels.find(p=>p.panel==='etf'&&p.information==='vintage'&&p.cohort==='real'),t=p.targets.find(t=>t.asset==='IEF'&&t.horizon===12);
 assert.match(periodCoverage(p,12),/Added versus original/);assert.match(periodCoverage(p,12),/2002-08/);
 assert.match(periodDetails(t,'rates'),/do not isolate/);assert.match(periodDetails(t,'rates'),/no new significance claim/);
});
