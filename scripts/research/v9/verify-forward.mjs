import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';
import {root,read,hash,same} from '../v6/verify.mjs';import {models} from './verify.mjs';
export function frozenReturn(snapshot,name){
 const {currentFeatures:x,means,sds,intercept,models:fits}=snapshot,cols=models[name],beta=fits[name].coefficients;
 const raw=intercept+cols.reduce((sum,j,k)=>sum+Math.max(-5,Math.min(5,(x[j]-means[j])/sds[j]))*beta[k],0);return Math.max(-.5,Math.min(.5,raw));
}
export async function verify(){
 const ledger=await read('data/return-forward-ledger.json'),git=promisify(execFile);let predictions=0;
 for(const r of ledger.records){
  assert.ok(Date.parse(r.issuedAt)<Date.parse(`${r.plannedStartDate}T00:00:00Z`));assert.ok(r.inputCutoff<=r.issuedAt.slice(0,10));assert.equal(r.outcomes,null);assert.equal(r.sharedOutcomeCount,1);assert.equal(r.protocolSha256,await hash('scripts/research/v9/forward-protocol.md'));
  const receipt=ledger.sourceReceipts.find(s=>s.recordId===r.id);assert.equal(receipt.sha256,r.researchSha256);
  const {stdout:raw}=await git('git',['show',`${receipt.commit}:${receipt.path}`],{cwd:root,encoding:'buffer',maxBuffer:16*1024*1024});assert.equal(createHash('sha256').update(raw).digest('hex'),r.researchSha256);const archived=JSON.parse(raw);
  const {stdout:original}=await git('git',['show',`${receipt.commit}:data/return-forward-ledger.json`],{cwd:root,maxBuffer:2*1024*1024});assert.deepEqual(JSON.parse(original).records.find(s=>s.id===r.id),r);
  for(const [cohort,c] of Object.entries(r.cohorts)){
   const source=archived.cohorts[cohort].forecasts.at(-1);assert.equal(c.trainingCount,source.trainingCount);assert.equal(c.lastTrainingMaturity,source.lastTrainingMaturity);assert.ok(c.lastTrainingMaturity<=r.inputCutoff);same(source.predictions,c.forecasts);
   for(const [name,value] of Object.entries(c.forecasts)){same(frozenReturn(c.frozenModel,name),value);predictions++;}
  }
 }
 assert.equal(predictions,12);ledger.audit={status:'Immutable annual forecast issuance and frozen models verified',recordChecks:ledger.records.length,predictionChecks:predictions,sharedOutcomeCount:ledger.records.length};await writeFile(new URL('data/return-forward-ledger.json',root),JSON.stringify(ledger));console.log(JSON.stringify(ledger.audit));return ledger;
}
if(process.argv[1]&&new URL(process.argv[1],'file://').href===import.meta.url)await verify();
