import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {guardWeight} from '../scripts/research/v8/verify.mjs';import {utilityWeight,fit} from '../scripts/research/v9/verify.mjs';
import {frozenReturn} from '../scripts/research/v9/verify-forward.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url)));
test('forecast guard reduces exposure while retaining the historical risk ceiling',()=>{
 for(const variance of [.0001,.01,.04,.16,1])for(const pastVol of [.01,.1,.2,.5,1])assert.ok(guardWeight(variance,pastVol)<=Math.min(1,.1/pastVol));assert.equal(guardWeight(null,.2),0);
});
test('return utility allocation respects its risk aversion, long-only constraint and cap',()=>{
 assert.equal(utilityWeight(-.1,.04,.8),0);assert.equal(utilityWeight(.5,.01,.6),.6);assert.ok(Math.abs(utilityWeight(.03,.04,.8)-.25)<1e-12);assert.equal(utilityWeight(.1,0,.8),0);
});
test('independent annual regression leaves the historical-mean intercept unpenalized',()=>{
 const x=Array.from({length:156},()=>Array(7).fill(1)),y=Array.from({length:156},(_,i)=>-.1+.4*i/155),r=fit(x,y,Array(7).fill(100),['mean','market','stress']);
 for(const v of Object.values(r.predictions))assert.ok(Math.abs(v-.1)<1e-12);
});
test('additional economic attempts remain visible and do not overwrite the risk input',async()=>{
 const guard=await read('data/risk-guard.json'),annual=await read('data/return-research.json'),bytes=await readFile(new URL('../data/risk-research.json',import.meta.url));const hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(guard.riskInputSha256,hash);assert.equal(annual.riskInputSha256,hash);assert.equal(guard.procedureCount,6);assert.equal(annual.procedureCount,12);assert.equal(annual.policyProcedureCount,30);
 assert.equal(guard.confirmedEdge,false);assert.equal(annual.confirmedEdge,false);for(const s of Object.values(guard.strategies))assert.equal(s.practicalCandidate,false);
});
test('every annual forecast exposes genuinely mature training labels and its separate risk horizon',async()=>{
 const annual=await read('data/return-research.json'),recovery=await read('data/recovery-research.json'),risk=await read('data/risk-research.json'),near=new Map(risk.horizons[4].main.forecasts.map(r=>[r.i,r.predictions.vix]));let checks=0;
 for(const study of Object.values(annual.cohorts))for(const r of study.forecasts){assert.ok(r.lastTrainingMaturity<=recovery.calendar[r.i].cutoff);assert.ok(r.trainingCount>=156&&r.trainingCount<=520);assert.equal(r.nearTermVariance,near.get(r.i));for(const p of Object.values(r.predictions))assert.ok(p>=-.5&&p<=.5);checks++;}
 assert.equal(checks,annual.audit.trainingChecks);
});
test('the prospective annual pilot preserves all frozen estimates before one shared future outcome',async()=>{
 const ledger=await read('data/return-forward-ledger.json');let checks=0;
 for(const r of ledger.records){
  assert.ok(Date.parse(r.issuedAt)<Date.parse(r.plannedStartDate));assert.ok(r.inputCutoff<=r.issuedAt.slice(0,10));assert.equal(r.outcomes,null);assert.equal(r.sharedOutcomeCount,1);
  assert.deepEqual(Object.keys(r.cohorts),['main','price','context']);
  for(const [cohort,c] of Object.entries(r.cohorts)){
   assert.deepEqual(Object.keys(c.forecasts),['mean','market','stress',...(cohort==='main'?[]:['price']),...(cohort==='context'?['full']:[])]);
   assert.ok(c.lastTrainingMaturity<=r.inputCutoff);
   for(const [name,value] of Object.entries(c.forecasts)){assert.ok(Math.abs(frozenReturn(c.frozenModel,name)-value)<1e-12);checks++;}
  }
  const receipt=ledger.sourceReceipts.find(s=>s.recordId===r.id);assert.equal(receipt.sha256,r.researchSha256);assert.match(receipt.commit,/^[0-9a-f]{40}$/);
 }
 assert.equal(checks,12);assert.equal(ledger.audit.predictionChecks,checks);assert.equal(ledger.audit.sharedOutcomeCount,1);
});
