import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {packPolicies,policyRows,policyWealth,POLICY_COLUMNS} from '../lib/research-paths.mjs';
import {transact,confirmations} from '../scripts/research/v6/verify.mjs';
import {fit,qlike,blockTest} from '../scripts/research/v7/verify.mjs';
const row={i:0,weight:.5,return:.01,stressReturn:.009,turnover:.5,cost:.0005,terminalCost:0,terminalTurnover:0,eventActive:true,coreOn:false};
test('research row packing preserves every numerical field and does not mutate the candidate',()=>{
 const d={cohorts:{main:{strategies:{a:{rows:[row]}}}}},p=packPolicies(d);assert.equal(Array.isArray(d.cohorts.main.strategies.a.rows[0]),false);
 assert.deepEqual(policyRows(p.cohorts.main.strategies.a,p),[row]);assert.equal(p.policyColumns.length,POLICY_COLUMNS.length);
 assert.deepEqual(policyWealth(p.cohorts.main.strategies.a,p),[{i:0,value:1.01}]);
});
test('invalid policy schema or truncated rows cannot silently render a wealth curve',()=>{
 assert.throws(()=>policyRows({rows:[[1,2]]},{policyColumns:[...POLICY_COLUMNS]}));assert.throws(()=>policyRows({rows:[]},{policyColumns:['return']}));
});
test('independent self-financing solver conserves cash and meets post-fee target',()=>{
 const {notional,cost}=transact(.1,.9,.0025);assert.ok(Math.abs(.1+notional-.9*(1-cost))<1e-12);
});
test('independent confirmation rejects a signal after expiry',()=>{
 const rows=Array.from({length:28},(_,i)=>({i,week:new Date(Date.UTC(2020,0,3+i*7)).toISOString().slice(0,10),setup:i===0,stressImproving:i===27}));
 assert.equal(confirmations(rows,0,'stress')[0].status,'expired');
});
test('independent log-risk calibration recovers arithmetic risk with constant features',()=>{
 const y=Array.from({length:104},(_,i)=>.01+i*.001),x=y.map(()=>[1,1,1]);const r=fit(x,y,[1,1,1],['vix']);
 assert.ok(Math.abs(r.predictions.vix-y.reduce((s,v)=>s+v,0)/y.length)<1e-12);
});
test('QLIKE measures variance error rather than signed return accuracy',()=>{
 assert.equal(qlike(.04,.04),0);assert.ok(qlike(.25,.01)>qlike(.25,.1));
});
test('risk block inference retains calendar gaps and counts actual pairs',()=>{
 const a=Array.from({length:156},(_,i)=>i%9===0?NaN:1),b=a.map(v=>v-.1),starts=Array.from({length:5},(_,i)=>[i,i+52,i+104]);
 const r=blockTest(a,b,starts);assert.equal(r.n,a.filter(Number.isFinite).length);assert.ok(Math.abs(r.difference-.1)<1e-12);assert.equal(r.blockWeeks,52);
});
test('published recovery results retain all failed attempts and source-defined cohorts',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/recovery-research.json',import.meta.url)));assert.equal(d.totalProcedureCount,51);assert.equal(d.audit.procedureChecks,51);assert.equal(d.confirmedEdge,false);
 for(const c of Object.values(d.cohorts))for(const s of Object.values(c.strategies))if(s.gates)assert.equal(s.economicCandidate||s.defensiveCandidate,false);
});
test('risk findings distinguish near-term forecast improvement, HY contribution and one-year limits',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/risk-research.json',import.meta.url)));assert.equal(d.procedureCount,63);assert.equal(d.audit.procedureChecks,63);
 assert.equal(d.horizons[4].main.strongerRiskSupport,true);assert.equal(d.horizons[4].main.incrementalHYSupport,false);assert.equal(d.horizons[52].main.strongerRiskSupport,false);assert.equal(d.confirmedEdge,false);
});
test('issued forward pilot predates its start, retains twelve forecasts and has no invented outcome',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/risk-forward-ledger.json',import.meta.url)));assert.equal(d.audit.predictionChecks,12);
 for(const r of d.records){assert.ok(Date.parse(r.issuedAt)<Date.parse(r.plannedStartDate));assert.equal(r.outcomes,null);for(const h of Object.values(r.horizons)){assert.equal(Object.keys(h.varianceForecasts).length,6);assert.ok(h.lastTrainingMaturity<=r.inputCutoff);}}
});

test('compact risk paths reconstruct exact fees and shared calendar states',()=>{
 const original={...row,eventActive:false,coreOn:true},d={horizons:{4:{main:{strategies:{vix:{rows:[original]}}}}}},packed=packPolicies(d,{risk:true});
 assert.equal(packed.policyColumns.length,7);assert.deepEqual(policyRows(packed.horizons[4].main.strategies.vix,packed,[{gap40:.1}]),[original]);
});

test('every risk portfolio shard matches its published source receipt',async()=>{
 const {createHash}=await import('node:crypto'),d=JSON.parse(await readFile(new URL('../data/risk-research.json',import.meta.url)));let count=0;
 for(const [h,cohorts] of Object.entries(d.horizons))for(const [cohort,s] of Object.entries(cohorts)){
  const bytes=await readFile(new URL('..'+s.policyPathReceipt.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),s.policyPathReceipt.sha256);
  const paths=JSON.parse(bytes);assert.equal(paths.horizon,h);assert.equal(paths.cohort,cohort);for(const model of s.models)assert.equal(paths.rows[model].length,s.holdingIntervals);count++;
 }
 assert.equal(count,9);assert.equal(d.audit.policyShardChecks,9);
});
