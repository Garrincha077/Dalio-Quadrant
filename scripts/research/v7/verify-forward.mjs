import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {createHash} from 'node:crypto';import {writeFile} from 'node:fs/promises';
import {root,read,same,hash} from '../v6/verify.mjs';
const ledger=await read('data/risk-forward-ledger.json'),risk=await read('data/risk-research.json'),fits=await read('work/research-v7/private-fits.json');
const git=promisify(execFile);let predictions=0;
for(const r of ledger.records){
 assert.ok(Date.parse(r.issuedAt)<Date.parse(`${r.plannedStartDate}T00:00:00Z`));assert.ok(r.inputCutoff<=r.issuedAt.slice(0,10));assert.equal(r.outcomes,null);assert.equal(r.protocolSha256,await hash('scripts/research/v7/forward-protocol.md'));
 const receipt=ledger.sourceReceipts.find(s=>s.recordId===r.id);assert.equal(receipt.sha256,r.researchSha256);
 const {stdout:raw}=await git('git',['show',`${receipt.commit}:${receipt.path}`],{cwd:root,encoding:'buffer',maxBuffer:32*1024*1024});
 assert.equal(createHash('sha256').update(raw).digest('hex'),r.researchSha256);
 const {stdout:original}=await git('git',['show',`${receipt.commit}:data/risk-forward-ledger.json`],{cwd:root,maxBuffer:2*1024*1024});assert.deepEqual(JSON.parse(original).records.find(s=>s.id===r.id),r);
 for(const h of ['4','52']){const source=risk.horizons[h].main.forecasts.at(-1),f=fits[h].main.at(-1),snapshot=r.horizons[h];assert.ok(snapshot.lastTrainingMaturity<=r.inputCutoff);assert.equal(snapshot.trainingCount,source.trainingCount);assert.equal(snapshot.lastTrainingMaturity,source.lastTrainingMaturity);same(source.predictions,snapshot.varianceForecasts);same({means:f.means,sds:f.sds,models:f.models},snapshot.frozenTransforms);predictions+=Object.keys(source.predictions).length;}
}
ledger.audit={status:'Immutable pre-target issuance and forecasts verified',recordChecks:ledger.records.length,predictionChecks:predictions,sourceSnapshotsVerified:ledger.sourceReceipts.length};
await writeFile(new URL('data/risk-forward-ledger.json',root),JSON.stringify(ledger));console.log(JSON.stringify(ledger.audit));
