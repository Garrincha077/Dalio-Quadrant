import assert from 'node:assert/strict';import {writeFile,rename} from 'node:fs/promises';
import {root,read,hash,reconstruct,policy,same,gates,bootstrap} from '../v6/verify.mjs';
import {packPolicies,policyRows} from '../../../lib/research-paths.mjs';
export function guardWeight(variance,pastVol){return Number.isFinite(variance)&&Number.isFinite(pastVol)&&variance>0&&pastVol>0?Math.min(1,.1/Math.sqrt(variance),.1/pastVol):0;}
export async function verify(){
 const d=await read('work/research-v8/research-candidate.json'),risk=await read('data/risk-research.json'),study=risk.horizons[4].main,{calendar:cal,spy}=await reconstruct();
 for(const [file,key] of [['scripts/research/v8/protocol.md','protocolSha256'],['data/risk-research.json','riskInputSha256'],['data/recovery-research.json','recoveryInputSha256']])assert.equal(await hash(file),d[key]);
 assert.equal(await hash(study.policyPathReceipt.path.slice(1)),study.policyPathReceipt.sha256);
 const paths=await read(study.policyPathReceipt.path.slice(1)),lookup=new Map(study.forecasts.map(r=>[r.i,r])),s={},original={};
 const audit={policyChecks:0,summaryChecks:0,guardBoundChecks:0,bootstrapChecks:0,procedureChecks:0};
 for(const name of study.models){
  const clock=cal.map(r=>({...r,riskCap:lookup.has(r.i)?guardWeight(lookup.get(r.i).predictions[name],r.pastVol):0}));
  const expected=policy(clock,spy,study.calendarStartIndex,'market',[]);expected.kind='forecast-guard';same(expected,d.strategies[name]);s[name]=expected;
  audit.policyChecks+=expected.rows.length;audit.summaryChecks+=1+Object.keys(expected.folds).length+Object.keys(expected.omitBlocks).length;audit.procedureChecks++;
  for(const row of expected.rows){assert.ok(row.weight>=0&&row.weight<=1&&row.weight<=cal[row.i].riskCap+1e-12);audit.guardBoundChecks++;}
 }
 for(const name of ['past52','market']){
  const clock=cal.map(r=>({...r,riskCap:lookup.has(r.i)?Math.min(1,.1/Math.sqrt(lookup.get(r.i).predictions[name])):0})),p=policy(clock,spy,study.calendarStartIndex,'market',[]);p.kind='forecast-risk';
  same(p,{...study.strategies[name],rows:policyRows({rows:paths.rows[name]},risk,cal)});original[name]=p;audit.policyChecks+=p.rows.length;
 }
 same(original.past52.rows,s.past52.rows);
 const refs={past52:original.past52,market:original.market,'guarded-market':s.market};
 for(const name of study.models){const actual=d.strategies[name],g=Object.fromEntries(Object.entries(refs).map(([k,p])=>[k,gates(actual,p)]));same(g,actual.gates);assert.equal(actual.practicalCandidate,Object.values(g).every(v=>v.higherReturn||v.defensiveTradeoff));assert.equal(actual.confirmedEdge,false);}
 const starts=await read('work/research-v8/bootstrap-starts.json'),cash=cal.slice(study.calendarStartIndex,-1).map(r=>r.cashReturn),tests=[];
 assert.equal(starts.length,2500);for(const row of starts){assert.equal(row.length,Math.ceil(cash.length/52));for(const v of row)assert.ok(Number.isInteger(v)&&v>=0&&v<cash.length);}
 for(const name of ['vix','stress'])for(const ref of Object.keys(refs)){
  const a=s[name],b=refs[ref],t={model:name,reference:ref,...bootstrap(a.rows.map(r=>r.return),b.rows.map(r=>r.return),cash,starts),foldGains:{}};
  for(const label of Object.keys(a.folds))t.foldGains[label]=a.folds[label].annualMeanExcess-b.folds[label].annualMeanExcess;tests.push(t);audit.bootstrapChecks++;
 }
 let last=0;for(const [rank,t] of [...tests].sort((a,b)=>a.p-b.p).entries()){last=Math.min(1,Math.max(last,(6-rank)*t.p));t.holmP=last;}same(tests,d.primaryComparisons);
 for(const name of ['vix','stress'])assert.equal(d.strategies[name].strongerSupport,!!(d.strategies[name].practicalCandidate&&tests.filter(t=>t.model===name).every(t=>t.lower95>0&&t.holmP<.05&&Object.values(t.foldGains).every(v=>v>0))));
 assert.equal(d.confirmedEdge,false);d.audit={status:'Independent risk-guard reconstruction passed',...audit};const packed=packPolicies(d);for(const name of study.models)assert.deepEqual(policyRows(packed.strategies[name],packed),d.strategies[name].rows);
 const tmp=new URL('data/risk-guard.json.tmp',root);await writeFile(tmp,JSON.stringify(packed));await rename(tmp,new URL('data/risk-guard.json',root));console.log(JSON.stringify(d.audit));return d;
}
if(process.argv[1]&&new URL(process.argv[1],'file://').href===import.meta.url)await verify();
