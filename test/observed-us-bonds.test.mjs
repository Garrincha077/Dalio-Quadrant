import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {observedMasks} from '../observed-bonds-view.mjs';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url));
const data=JSON.parse(await read('data/observed-us-bonds.json'));
const hash=async p=>createHash('sha256').update(await read(p)).digest('hex');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const shift=(m,n)=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1+n,1)).toISOString().slice(0,7);
const quantile=a=>{const b=[...a].sort((a,b)=>a-b),i=(b.length-1)/2;return (b[Math.floor(i)]+b[Math.ceil(i)])/2;};
function check(rows,results){for(const [s,r] of Object.entries(results)){const chosen=rows.filter(r=>r.policies[s].enter);assert.equal(r.nScored,rows.length);assert.equal(r.selectedStarts,chosen.length);if(chosen.length){close(r.mean,mean(chosen.map(r=>r.actual)));close(r.lift,r.mean-mean(rows.map(r=>r.actual)));}else{assert.equal(r.mean,null);assert.equal(r.lift,null);}}}

test('US-only issuer study freezes the source recipe and rejects unavailable as-of history',async()=>{
 assert.equal(data.builderSha256,await hash('scripts/research/observed_us_bonds.py'));
 assert.equal(data.protocolSha256,await hash('scripts/research/observed-us-bonds-protocol.md'));
 assert.equal(data.collectorSha256,await hash('scripts/research/fetch-ief-risk-history.py'));
 for(const [p,h] of Object.entries(data.dependencies))assert.equal(h,await hash('scripts/research/'+p));
 assert.equal(data.stateSourceSha256,await hash('data/state-forward.json'));
 assert.equal(data.scope,'United States / IEF only');assert.equal(data.targets.length,24);assert.equal(data.bootstrapDraws,5000);
 assert.equal(data.quality.exactSnapshots,233);assert.equal(data.quality.riskValidMonths,232);assert.equal(data.quality.unavailableDates,57);
 assert.equal(data.quality.sourceManifest.failures.length,0);
 for(const r of data.quality.sourceManifest.unavailable)assert.ok(!data.quality.riskRows.some(q=>q.date===r.date));
});

test('all fixed masks, conditional returns, paired gains and temporal segments reconcile',()=>{
 for(const t of data.targets){
  for(const r of t.records){const masks=observedMasks(r.risk,r.macro);for(const s of data.rules)assert.equal(r.policies[s].enter,masks[s]);assert.ok(!masks.weak||masks.disinflation);assert.ok(!masks.disinflation||masks.carry);}
  check(t.records,t.results);
  for(const s of t.segments)check(t.records.filter(r=>s.start<=r.entry&&r.entry<s.endExclusive),s.results);
  assert.equal(t.records.length,t.segments.reduce((n,s)=>n+s.results.carry.nScored,0));
  for(const v of Object.values(t.incremental)){const a=t.results[v.left],b=t.results[v.right];assert.equal(v.supported,a.supported&&b.supported);if(a.mean===null||b.mean===null)assert.equal(v.gain,null);else close(v.gain,a.mean-b.mean);}
 }
});

test('each five-year reference uses only prior risk observations and honours its declared gap gate',()=>{
 const risks=new Map(data.quality.riskRows.map(r=>[r.month,r]));
 for(const t of data.targets)for(const r of t.records){
  const current=shift(r.entry,-2),first=shift(current,-60),last=shift(current,-1);assert.equal(r.risk.month,current);
  assert.equal(r.risk.referenceFirst,first);assert.equal(r.risk.referenceLast,last);assert.ok(first>=data.quality.firstRisk);
  const prior=Array.from({length:60},(_,i)=>risks.get(shift(first,i)));const valid=prior.filter(Boolean);
  assert.equal(r.risk.referenceCount,valid.length);close(r.risk.medianCushion,quantile(valid.map(v=>v.cushion)));
  if(t.referenceMode==='complete60')assert.equal(valid.length,60);else{assert.ok(valid.length>=48);assert.ok(r.risk.referenceMaxGap<=6);}
  close(r.risk.cushion,r.risk.ytm/r.risk.duration);assert.ok(r.risk.riskCoverage>=.99);
 }
});

test('Holm families include both reference modes and both return bases',()=>{
 for(const info of ['revised','vintage']){
  const all=data.targets.filter(t=>t.information===info).flatMap(t=>[...Object.values(t.results),...Object.values(t.incremental)]),eligible=all.filter(r=>r.supported&&r.bootstrapP!=null).sort((a,b)=>a.bootstrapP-b.bootstrapP);let current=0;
  eligible.forEach((r,i)=>{current=Math.max(current,(eligible.length-i)*r.bootstrapP);close(r.holmP,Math.min(1,current));});
  for(const r of all.filter(r=>!r.supported||r.bootstrapP==null))assert.equal(r.holmP,null);
 }
});

test('all public CSV decisions match the fixed rule on the same dated inputs',async()=>{
 const rows=(await read('data/observed-us-bonds.csv')).toString().trimEnd().split('\n'),cols=rows.shift().split(',');
 assert.equal(rows.length,3*data.targets.reduce((n,t)=>n+t.records.length,0));
 for(const line of rows){const r=Object.fromEntries(line.split(',').map((v,i)=>[cols[i],v])),macro=[+r.activity,+r.inflation,+r.deltaActivity,+r.deltaInflation],masks=observedMasks({cushion:+r.cushion,medianCushion:+r.medianCushion},macro);assert.equal(r.selected,masks[r.rule]?'True':'False');assert.equal(r.riskDate.slice(0,7),shift(r.entry,-2));}
});

test('NAV sensitivity cannot change eligible dates or entry masks and ex-post diagnostics remain separate',()=>{
 for(const market of data.targets.filter(t=>t.returnBasis==='market')){
  const nav=data.targets.find(t=>t.returnBasis==='nav'&&t.information===market.information&&t.referenceMode===market.referenceMode&&t.horizon===market.horizon);
  assert.deepEqual(market.records.map(r=>r.entry),nav.records.map(r=>r.entry));
  market.records.forEach((r,i)=>{assert.deepEqual(r.policies,nav.records[i].policies);assert.deepEqual(r.risk,nav.records[i].risk);if(r.horizon!==12)assert.equal(r.diagnostic,null);if(r.diagnostic){const d=r.diagnostic;close(d.approximateReturn,d.carry+d.durationShock);close(d.residual,d.actualBeforeEntryExitCost-d.approximateReturn);}});
 }
});
