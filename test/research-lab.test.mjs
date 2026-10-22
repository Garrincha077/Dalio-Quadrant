import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {labStudies,validateLab,labStudy,netWealth} from '../lib/research-lab.mjs';
const load=async()=>JSON.parse(await readFile(new URL('../data/research-lab.json',import.meta.url),'utf8'));
test('published research lab retains every declared configuration and verified protocol',async()=>{
 const d=await load();assert.ok(validateLab(d));assert.equal(labStudies(d).reduce((s,x)=>s+(x.attempts?.length||0),0),120);
 for(const [key,file] of [['protocolSha256','protocol.md'],['riskProtocolSha256','risk-protocol.md'],['policyProtocolSha256','policy-protocol.md']]){
  const sha=createHash('sha256').update(await readFile(new URL(`../scripts/research/v4/${file}`,import.meta.url))).digest('hex');
  assert.equal(sha,d[key]);
 }
});
test('lab does not accept a mismatched audit or a manufactured confirmed edge',async()=>{
 const d=await load();d.audit.checkedInputSha256='0'.repeat(64);assert.equal(validateLab(d),false);
 const other=await load();other.horizons['12'].main.comparisons[0].confirmedEdge=true;assert.equal(validateLab(other),false);
});
test('risk and value cohorts remain separately addressable',async()=>{
 const d=await load();assert.equal(labStudy(d,'portfolio','12','value'),d.portfolioSelection['12'].value);
 assert.equal(labStudy(d,'ranking','3','main'),d.horizons['3'].main);
 assert.equal(labStudy(d,'risk','3','value'),d.risk['3']);
});
test('dated records only select already known outcomes and cannot claim retrospective forecasts as live',async()=>{
 const d=await load();for(const study of labStudies(d))for(const row of study.forecastRows){
  assert.ok(row.cutoff<row.tradeDate);
  for(const [m,method] of Object.entries(row.methods)){
   if(m==='mean')continue;
   assert.ok(method.training>=60&&method.selectionCount>=24);
   assert.ok(method.lastTrainingMaturity<=row.cutoff&&method.selectionLastMaturity<=row.cutoff);
  }
 }
});
test('wealth chart compounds net returns including losses and costs',()=>{
 const series=netWealth([{month:'2020-01',return:.10},{month:'2020-02',return:-.10}]);
 assert.deepEqual(series.map(r=>r.value),[1,1.1,.9900000000000001]);
});
