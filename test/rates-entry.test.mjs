import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ratesModelScore,trainingRank,ratesResults} from '../rates-entry-view.mjs';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url));
const data=JSON.parse(await read('data/rates-entry.json'));
const hash=async p=>createHash('sha256').update(await read(p)).digest('hex');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;

test('yield study preserves dependencies and identifies actual archived market yields',async()=>{
 assert.equal(data.builderSha256,await hash('scripts/research/rates_entry.py'));
 assert.equal(data.protocolSha256,await hash('scripts/research/rates-entry-protocol.md'));
 assert.equal(data.stateSourceSha256,await hash('data/state-forward.json'));
 for(const [p,h] of Object.entries(data.dependencies))assert.equal(h,await hash('scripts/research/'+p));
 assert.deepEqual(data.stages,['base','rates','trend']);assert.deepEqual(data.cohorts,['nominal','real']);assert.equal(data.panels.length,8);
 assert.equal(data.bootstrapDraws,5000);assert.deepEqual(data.rateCollection.failures,[]);
 for(const id of ['GS10','FII10'])assert.equal(data.rateCollection.series.find(s=>s.id===id).snapshots,247);
});

test('every stage reconciles selected returns and each paired incremental comparison',()=>{
 for(const p of data.panels)for(const t of p.targets){
  const refs=new Map(t.refits.map(f=>[f.refitMonth.slice(0,4),f])),averages={};
  for(const stage of data.stages){
   const chosen=t.forecasts.filter(row=>{const m=p.models[refs.get(row.entry.slice(0,4)).models[stage]],s=ratesModelScore(m,row.x);return s>1e-12&&s>=m.threshold-1e-12;});
   const r=t.results[stage];assert.equal(r.nScored,t.forecasts.length);assert.equal(r.selectedStarts,chosen.length);
   averages[stage]=chosen.length?mean(chosen.map(r=>r.actual)):null;
   if(chosen.length){close(r.mean,averages[stage]);close(r.lift,r.mean-mean(t.forecasts.map(r=>r.actual)));}
   else assert.equal(r.lift,null);
   for(const row of t.forecasts){const m=p.models[refs.get(row.entry.slice(0,4)).models[stage]],rank=trainingRank(m,ratesModelScore(m,row.x));assert.ok(rank===null||(rank>=0&&rank<=100));}
  }
  for(const v of Object.values(t.incremental)){
   if(averages[v.left]===null||averages[v.right]===null)assert.equal(v.gain,null);
   else close(v.gain,averages[v.left]-averages[v.right]);
   assert.equal(v.supported,t.results[v.left].supported&&t.results[v.right].supported);
  }
 }
});

test('all yield stage choices use matured earlier validation and retain matching fallbacks',()=>{
 for(const p of data.panels)for(const t of p.targets)for(const f of t.refits)for(const stage of data.stages){
  const m=p.models[f.models[stage]];assert.ok(m.lastTrainingExit<m.refitMonth);assert.ok(m.n>=60);
  assert.equal(m.cohort,p.cohort);assert.equal(m.inputCount,p.features.length);
  if(p.information==='vintage')assert.equal(m.vintageCutoff.slice(0,7),m.refitMonth);
  if(f.fallback)assert.equal(m.spec.id,stage+':100:0');
  else{
   assert.ok(f.lastValidationExit<f.refitMonth);assert.ok(f.folds>=3&&f.nValidation>=24);
   const eligible=f.candidates.filter(r=>r.family===stage&&r.entryStarts>=12&&r.entryEpisodes>=3&&r.entryLift>0).sort((a,b)=>b.entryLift-a.entryLift||(a.id<b.id?-1:a.id>b.id?1:0));
   assert.equal(m.spec.id,eligible[0]?.id??'unconditional');
  }
 }
});

test('Holm correction includes both availability cohorts and all supported stage comparisons',()=>{
 for(const info of ['revised','vintage'])for(const name of ['long','etf']){
  const rows=data.panels.filter(p=>p.information===info&&p.panel===name).flatMap(p=>p.targets.flatMap(t=>[...Object.values(t.results),...Object.values(t.incremental)]));
  const eligible=rows.filter(r=>r.supported&&r.bootstrapP!=null).sort((a,b)=>a.bootstrapP-b.bootstrapP);let current=0;
  eligible.forEach((r,i)=>{current=Math.max(current,(eligible.length-i)*r.bootstrapP);close(r.holmP,Math.min(1,current));});
  for(const r of rows.filter(r=>!r.supported||r.bootstrapP==null))assert.equal(r.holmP,null);
 }
});

test('matched nominal-cohort baseline reproduces the frozen 36-month joint price model',async()=>{
 const old=JSON.parse(await read('data/zscore-entry.json'));
 for(const p of data.panels.filter(p=>p.cohort==='nominal'))for(const t of p.targets){
  const prior=old.panels.find(q=>q.information===p.information&&q.panel===p.panel&&q.window===36).targets.find(q=>q.asset===t.asset&&q.horizon===t.horizon).results.joint;
  assert.equal(t.results.base.nScored,prior.nScored);assert.equal(t.results.base.selectedStarts,prior.selectedStarts);
  if(prior.lift===null)assert.equal(t.results.base.lift,null);else close(t.results.base.lift,prior.lift);
 }
});

test('historical ranks and CSV are distinct from probabilities and keep all three dated stages',async()=>{
 const csv=(await read('data/rates-entry.csv')).toString().trimEnd().split('\n');
 assert.equal(csv.length,1+3*data.panels.reduce((n,p)=>n+p.targets.reduce((n,t)=>n+t.forecasts.length,0),0));
 assert.match(csv[0],/trainingRank,enter,model/);
 const columns=csv[0].split(','),models=new Map(data.panels.flatMap(p=>Object.entries(p.models)));
 for(const line of csv.slice(1)){
  const r=Object.fromEntries(line.split(',').map((v,i)=>[columns[i],v])),m=models.get(r.model),s=Number(r.score),rank=trainingRank(m,s);
  if(rank===null)assert.equal(r.trainingRank,'');else close(Number(r.trainingRank),rank);
  assert.equal(r.enter,s>1e-12&&s>=m.threshold-1e-12?'True':'False');
 }
 assert.equal(trainingRank({scorePercentiles:null},0),null);
 close(trainingRank({scorePercentiles:Array.from({length:21},(_,i)=>(i-10)/100)},0),50);
 assert.match(ratesResults(data.panels[0].targets[0]),/Add initial yields/);
});
