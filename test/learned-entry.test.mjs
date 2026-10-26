import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {modelScore,responseMap,resultTable} from '../learned-entry-view.mjs';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url));
const data=JSON.parse(await read('data/learned-entry.json'));
const hash=async p=>createHash('sha256').update(await read(p)).digest('hex');

test('learned research identifies exact model/protocol inputs and actual vintage collection',async()=>{
 assert.equal(data.builderSha256,await hash('scripts/research/learned_entry.py'));
 assert.equal(data.protocolSha256,await hash('scripts/research/learned-entry-protocol.md'));
 assert.equal(data.stateSourceSha256,await hash('data/state-forward.json'));
 for(const [name,digest] of Object.entries(data.dependencies))assert.equal(digest,await hash('scripts/research/'+name));
 assert.equal(data.vintageCollection.completeSnapshots,185);assert.equal(data.vintageCollection.failures,0);
 assert.equal(data.panels.length,4);assert.equal(data.candidateCount,17);
});

test('all published objective-aligned forecasts reconcile with their dated model and outcomes',()=>{
 for(const p of data.panels)for(const t of p.targets){
  const rows=t.selectedForecasts,r=t.results.timing_selected;
  assert.equal(rows.length,r.nScored);
  const picked=rows.filter(x=>x.enter);
  assert.equal(picked.length,r.selectedStarts);
  if(picked.length){const normal=rows.reduce((s,x)=>s+x.actual,0)/rows.length,average=picked.reduce((s,x)=>s+x.actual,0)/picked.length;assert.ok(Math.abs(normal-r.usualMean)<1e-12);assert.ok(Math.abs(average-normal-r.lift)<1e-12);}
  for(const row of rows){const m=p.models[row.model];assert.ok(m.lastTrainingExit<m.refitMonth);assert.ok(m.refitMonth<=row.entry);assert.ok(Math.abs(modelScore(m,row.x)-row.score)<1e-10);assert.equal(row.enter,row.score>1e-12&&row.score>=m.threshold-1e-12);}
 }
});

test('nested choices have matured validation and explicit strong fallback',()=>{
 for(const p of data.panels)for(const t of p.targets)for(const f of t.refits){
  if(f.fallback){assert.equal(p.models[f.models.timing_selected].spec.id,'linear:100:0');}
  else{
   assert.ok(f.lastValidationExit<f.refitMonth);assert.ok(f.folds>=3);assert.ok(f.nValidation>=24);
   const eligible=f.candidates.filter(x=>x.entryStarts>=12&&x.entryEpisodes>=3&&x.entryLift>0).sort((a,b)=>b.entryLift-a.entryLift||(a.id<b.id?-1:a.id>b.id?1:0));
   assert.equal(p.models[f.models.timing_selected].spec.id,eligible[0]?.id??'unconditional');
  }
 }
});

test('vintage models and same-date comparisons retain their true information set',()=>{
 for(const p of data.panels)for(const m of Object.values(p.models)){
  assert.equal(m.information,p.information);
  if(p.information==='vintage'){assert.ok(m.vintageCutoff);assert.ok(m.vintageCutoff.slice(0,7)===m.refitMonth);}
  else assert.equal(m.vintageCutoff,null);
 }
 for(const c of data.commonDateComparison){assert.ok(c.nCommon>0);assert.ok(Math.abs(c.results.revised.fixed.usualMean-c.results.vintage.fixed.usualMean)<1e-12);}
});

test('research UI exposes model response as fitted evidence and no-entry as unavailable',()=>{
 const p=data.panels.find(p=>p.panel==='etf'&&p.information==='vintage'),t=p.targets.find(t=>t.asset==='SPY'&&t.horizon===12);
 const model=p.models[t.refits.at(-1).models.timing_selected];
 assert.match(responseMap(model),/not realised future performance/);assert.match(responseMap(model),/tabindex="0"/);
 assert.match(resultTable(t),/Later-period entry screens/);assert.match(resultTable(t),/Selected by past entry lift/);
 for(const r of Object.values(t.results))if(!r.selectedStarts){assert.equal(r.lift,null);assert.equal(r.mean,null);}
});
