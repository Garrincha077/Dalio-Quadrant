// Independent source-to-result reconstruction. No Python prediction or weight
// is used as an input to the independent estimates or policy calculations.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mean,quantile,ridgeForecast} from '../v3/independent-math.mjs';
import {rankIC} from '../../../lib/research-evidence.mjs';
const root=new URL('../../../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const hash=async p=>createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');
const data=await read('work/research-v4/research-candidate.json');
const audit=await read('work/research-v4/private-audit.json');
const base=await read('work/research-v2/features.json'),value=await read('work/research-v3/features.json');
const previous=await read('data/research-v2.json'),v3=await read('data/asset-scores.json');
assert.equal(data.protocolSha256,await hash('scripts/research/v4/protocol.md'));
assert.equal(data.riskProtocolSha256,await hash('scripts/research/v4/risk-protocol.md'));
assert.equal(data.policyProtocolSha256,await hash('scripts/research/v4/policy-protocol.md'));
assert.equal(previous.sources.featureSha256,await hash('work/research-v2/features.json'));
assert.equal(v3.audit.checkedInputSha256,await hash('work/research-v3/features.json'));
for(const [p,sha] of Object.entries(data.sourceHashes))assert.equal(await hash(p),sha,p);
const canonical=Object.fromEntries(Object.entries(data.sourceHashes).sort(([a],[b])=>a.localeCompare(b)));
assert.equal(createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),data.inputSha256);
for(const [version,manifest] of [['v2',await read('work/research-v2/source-manifest.json')],['v3',await read('work/research-v3/source-manifest.json')]])
 for(const s of manifest.sources)assert.equal(await hash(`work/research-${version}/fred/${s.id}.json`),s.sha256);
const A=data.assets,n=base.rows.length,clock=base.rows.map(r=>r.tradeDate.slice(0,7));
const finite=Number.isFinite,all=a=>a.every(finite),shift=(m,d)=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1+d,1)).toISOString().slice(0,7);
const end=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).toISOString().slice(0,10);
const sd=a=>Math.sqrt(a.reduce((s,v)=>s+(v-mean(a))**2,0)/(a.length-1));
const empty=()=>Array.from({length:n},()=>Array(5).fill(null));
const equal=(a,b)=>{if(!finite(a)){assert.equal(b,null);return;}assert.ok(finite(b)&&Math.abs(a-b)<=2e-8*Math.max(1,Math.abs(a)),`${a} != ${b}`);};
const counts={featureChecks:0,predictionChecks:0,trainingChecks:0,selectionChecks:0,outcomeChecks:0,policyChecks:0,bootstrapChecks:0,attemptChecks:0};
const prices={};
for(const a of A){
 const csv=(await readFile(new URL(`work/research-v2/prices/${a}.csv`,root),'utf8')).trim().split(/\r?\n/);
 const headers=csv.shift().split(','),date=headers.indexOf('timestamp'),close=headers.indexOf('adjusted close');
 prices[a]=new Map(csv.map(l=>l.split(',')).filter(r=>r[date].slice(0,7)<data.asOf.slice(0,7)).map(r=>[r[date].slice(0,7),+r[close]]));
}
const cash=clock.map((m,t)=>{
 if(t===n-1||clock[t+1]!==shift(m,1)||!finite(base.rows[t].cashYield))return null;
 const days=(Date.parse(base.rows[t+1].tradeDate)-Date.parse(base.rows[t].tradeDate))/86400000;
 return (1+base.rows[t].cashYield/100)**(days/365)-1;
});
const realised=clock.map((m,t)=>A.map(a=>cash[t]!==null&&prices[a].has(m)&&prices[a].has(shift(m,1))?prices[a].get(shift(m,1))/prices[a].get(m)-1:null));
const markets=[],vols=[],macro=[],histories=[],correlations=[];
for(let t=0;t<n;t++){
 const m=clock[t],market=[],vol=[],history=[];
 for(let a=0;a<5;a++){
  const p=Array.from({length:37},(_,k)=>prices[A[a]].get(shift(m,k-37)));
  if(!all(p)){market.push([null,null,null,null]);vol.push(null);history.push(null);continue;}
  const r=p.slice(1).map((v,i)=>v/p[i]-1),v=sd(r)*Math.sqrt(12);
  vol.push(v);history.push(r);
  market.push([p[36]/p[33]-1,p[36]/p[25]-1,v,base.rows[t].cashYield]);
 }
 const earlier=clock.indexOf(shift(m,-3)),s=base.rows[t],prev=base.rows[earlier];
 const row=prev&&all([s.activity,s.inflationGap,prev.activity,prev.inflationGap])?
  [s.activity,s.inflationGap,s.activity-prev.activity,s.inflationGap-prev.inflationGap]:[null,null,null,null];
 markets.push(market);vols.push(vol);macro.push(row);histories.push(history);
 correlations.push(history.every(Boolean)?history.map(x=>history.map(y=>mean(x.map((v,i)=>(v-mean(x))*(y[i]-mean(y))))/(sd(x)*sd(y))*36/35)):null);
 for(let a=0;a<5;a++){for(let j=0;j<4;j++){equal(market[a][j],audit.markets[t][a][j]);counts.featureChecks++;}equal(vol[a],audit.vols[t][a]);}
 row.forEach((v,j)=>{equal(v,audit.macro[t][j]);counts.featureChecks++;});
 equal(cash[t],audit.cash[t]);realised[t].forEach((v,j)=>equal(v,audit.realised[t][j]));
}
const loss=(p,y)=>all(p)&&all(y)?mean(p.map((v,i)=>y[i]/v+Math.log(v))):null;
const rank=p=>p.map(v=>1+p.filter(x=>x<v).length+.5*(p.filter(x=>x===v).length-1));
const trainAt=(t,eligible,y,mature,window)=>{
 const ix=clock.flatMap((_,i)=>eligible[i]&&all(y[i])&&mature[i]&&mature[i]<=base.rows[t].cutoff?[i]:[]);
 return window?ix.slice(-window):ix;
};
const input=(t,a,family,riskMarket=null)=>{
 const r=[...(riskMarket?riskMarket[t][a]:markets[t][a])],s=macro[t];
 if(family!=='market')r.push(...s);
 if(['interaction','value-price'].includes(family))r.push(s[0]*s[2],s[1]*s[3],s[2]*s[3],r[1]*s[2],r[1]*s[3]);
 if(family==='value-price'){
  const v=value.rows[t].assets[A[a]].value.z,p=value.rows[t].assets[A[a]].price.z;
  r.push(v,p,v*s[2],v*s[3],p*s[2],p*s[3]);
 }
 return r;
};
function targets(h,risk){
 const y=empty(),mature=Array(n).fill(null);
 for(let t=0;t+h<n;t++){
  if(clock[t+h]!==shift(clock[t],h)||!all(cash.slice(t,t+h)))continue;
  if(risk){
   if(!realised.slice(t,t+h).every(all))continue;
   y[t]=A.map((_,a)=>12*mean(realised.slice(t,t+h).map((r,k)=>(r[a]-cash[t+k])**2)));
  }else{
   const carry=cash.slice(t,t+h).reduce((s,v)=>s*(1+v),1);
   y[t]=A.map(a=>{
    const p=Array.from({length:h+1},(_,k)=>prices[a].get(shift(clock[t],k)));
    return all(p)?p.at(-1)/p[0]-carry:null;
   });
  }
  mature[t]=end(shift(clock[t],h));
 }
 return {y,mature};
}
function riskMarkets(){
 return markets.map((r,t)=>r.map((p,a)=>[...p,...[3,12].map(h=>{
  if(t-h-1<0)return null;
  if(!realised.slice(t-h-1,t-1).every(all)||!all(cash.slice(t-h-1,t-1)))return null;
  const x=realised.slice(t-h-1,t-1).map((row,k)=>finite(row[a])&&finite(cash[t-h-1+k])?row[a]-cash[t-h-1+k]:null);
  return x.length===h&&all(x)?Math.sqrt(12*mean(x.map(v=>v*v))):null;
 })]));
}
function weights(pred,t,mode){
 const cash=[1,0,0,0,0,0];
 if(!pred||!all(pred)||!all(vols[t]))return cash;
 let target,forecast=null;
 if(mode==='risk'){
  forecast=pred.map((v,a)=>Math.max(.5*vols[t][a],Math.min(2*vols[t][a],Math.sqrt(v))));
  target=forecast.map(v=>1/v);
 }else if(mode==='winner'){
  target=Array(5).fill(0);if(Math.max(...pred)>0)target[pred.indexOf(Math.max(...pred))]=1;
 }else if(mode==='tilt'){
  const ranks=rank(pred);target=vols[t].map((v,a)=>(1/v)*(1+.5*(ranks[a]-3)/2));
 }else target=[...pred];
 const total=target.reduce((s,v)=>s+v,0);if(total<=0)return cash;
 target=target.map(v=>v/total);
 const v=forecast||vols[t],corr=correlations[t];if(!corr)return cash;
 const variance=target.reduce((s,w,a)=>s+w*v[a]*target.reduce((p,k,b)=>p+k*v[b]*corr[a][b],0),0);
 const scale=Math.min(1,.10/Math.sqrt(variance)),risky=target.map(w=>w*scale);
 return [1-risky.reduce((s,v)=>s+v,0),...risky];
}
function policy(predictions,mask,mode){
 const rows=[];let prior=[1,0,0,0,0,0];
 for(let t=0;t<n;t++){
  if(!mask[t])continue;
  const w=weights(predictions[t],t,mode),r=[cash[t],...realised[t]];
  const cost=mean(w.slice(1).map((v,a)=>Math.abs(v-prior[a+1])))*5*.001;
  const turnover=w.reduce((s,v,a)=>s+Math.abs(v-prior[a]),0)/2;
  const gross=w.reduce((s,v,a)=>s+v*r[a],0),net=gross-cost;
  rows.push({month:shift(clock[t],1),return:net,cash:cash[t],cost,turnover,weights:w,stress:gross-2.5*cost});
  const grown=w.map((v,a)=>v*(1+r[a])),sum=grown.reduce((s,v)=>s+v,0);prior=grown.map(v=>v/sum);
 }
 return rows;
}
function metrics(rows){
 const ret=rows.map(r=>r.return),rf=rows.map(r=>r.cash),ex=ret.map((v,i)=>v-rf[i]);let wealth=1,peak=1,dd=0;
 for(const r of ret){wealth*=1+r;peak=Math.max(peak,wealth);dd=Math.min(dd,wealth/peak-1);}
 return {months:rows.length,cagr:wealth**(12/rows.length)-1,sharpe:mean(ex)/sd(ex)*Math.sqrt(12),
  volatility:sd(ret)*Math.sqrt(12),maxDrawdown:dd,costTotal:rows.reduce((s,r)=>s+r.cost,0),
  turnoverPerYear:mean(rows.map(r=>r.turnover))*12,cashExposure:mean(rows.map(r=>r.weights[0])),
  cagrAt25bps:rows.reduce((s,r)=>s*(1+r.stress),1)**(12/rows.length)-1};
}
function checkPolicy(expected,published,withRows=true){
 const actual=metrics(expected);for(const [k,v] of Object.entries(actual))equal(v,published[k]);
 if(withRows){assert.equal(expected.length,published.rows.length);
  expected.forEach((r,i)=>{const p=published.rows[i];assert.equal(r.month,p.month);
   for(const k of ['return','cash','cost','turnover'])equal(r[k],p[k]);r.weights.forEach((w,a)=>equal(w,p.weights[a]));counts.policyChecks++;
  });
 }
 return expected;
}
function checkBootstrap(a,b,h,published,policyMode=false,rf=null){
 if(!published.available)return;
 const block=Math.max(12,h),draws=audit.bootstrapDraws[`${a.length}:${block}`];assert.equal(draws.length,2500);
 const statistic=(x,y,cash)=>policyMode?mean(x.map((v,i)=>v-cash[i]))/sd(x.map((v,i)=>v-cash[i]))*Math.sqrt(12)-mean(y.map((v,i)=>v-cash[i]))/sd(y.map((v,i)=>v-cash[i]))*Math.sqrt(12):mean(x.flatMap((v,i)=>finite(v)&&finite(y[i])?[v-y[i]]:[]));
 const observed=statistic(a,b,rf),samples=[];
 for(const indices of draws){
  assert.equal(indices.length,a.length);
  indices.forEach((v,i)=>{assert.ok(Number.isInteger(v)&&v>=0&&v<a.length);if(i%block)assert.equal(v,(indices[i-1]+1)%a.length);});
  const x=indices.map(i=>a[i]),y=indices.map(i=>b[i]),cash=rf&&indices.map(i=>rf[i]);
  const v=statistic(x,y,cash);if(finite(v))samples.push(v);
 }
 equal(observed,published.difference);equal(quantile(samples,.025),published.lower95);equal(quantile(samples,.975),published.upper95);
 const p=(1+samples.filter(v=>Math.abs(v-observed)>=Math.abs(observed)-1e-12).length)/(samples.length+1);
 equal(p,published.p);counts.bootstrapChecks++;
}
const mainComparisons=[],utilityComparisons=[],verifiedStudies={};
async function verifyStudy(study,internal,h,cohort,risk){
 const {y,mature}=targets(h,risk),rm=risk?riskMarkets():null;
 const families=['market','macro','interaction',...(cohort==='value'?['value-price']:[])];
 const configs=families.flatMap(family=>[100,1000,10].flatMap(alpha=>[0,120].map(window=>({id:`${family}:r${alpha}:w${window||'all'}`,family,alpha,window}))));
 assert.deepEqual(configs,internal.configurations);assert.equal(configs.length,study.attempts.length);
 const eligible=clock.map((_,t)=>all(macro[t])&&(rm||markets)[t].every(all)&&
  (cohort!=='value'||A.every(a=>finite(value.rows[t].assets[a].value.z)&&finite(value.rows[t].assets[a].price.z))));
 assert.deepEqual(eligible,internal.eligible);
 const target=risk?y.map((r,t)=>r.map((v,a)=>finite(v)&&finite(vols[t][a])?Math.log(v/vols[t][a]**2):null)):y;
 for(let t=0;t<n;t++)for(let a=0;a<5;a++){equal(y[t][a],internal.targets[t][a]);if(finite(y[t][a]))counts.outcomeChecks++;}
 if(risk)for(let t=0;t<n;t++)for(let a=0;a<5;a++)for(let j=0;j<6;j++)equal(rm[t][a][j],internal.markets[t][a][j]);
 const predictions=[];
 for(let ci=0;ci<configs.length;ci++){
  const c=configs[ci],p=empty(),xs=A.map((_,a)=>clock.map((_,t)=>input(t,a,c.family,rm)));
  for(let t=0;t<n;t++){
   if(!eligible[t])continue;
   const train=trainAt(t,eligible,target,mature,c.window);if(train.length<60)continue;
   for(let a=0;a<5;a++){
    const estimate=ridgeForecast(train.map(i=>xs[a][i]),train.map(i=>target[i][a]),xs[a][t],c.alpha);
    if(risk)equal(estimate,internal.logPredictions[ci][t][a]);
    p[t][a]=risk?vols[t][a]**2*Math.exp(estimate):estimate;counts.predictionChecks++;
   }
   counts.trainingChecks++;
  }
  for(let t=0;t<n;t++)p[t].forEach((v,a)=>equal(v,internal.predictions[ci][t][a]));
  predictions.push(p);
 }
 const quality=predictions.map(p=>p.map((r,t)=>risk?loss(r,y[t]):rankIC(r,y[t])));
 const selected=Object.fromEntries([...families,'adaptive',...(risk?['past-risk']:['mean'])].map(m=>[m,empty()]));
 const ready=Array(n).fill(false),choices={};
 const publicRows=new Map(study.forecastRows.map(r=>[r.month,r]));
 for(let t=0;t<n;t++){
  if(!predictions.every(p=>all(p[t])))continue;
  const history=clock.flatMap((_,i)=>all(y[i])&&predictions.every(p=>all(p[i]))&&mature[i]&&mature[i]<=base.rows[t].cutoff?[i]:[]).slice(-60);
  if(history.length<24)continue;
  ready[t]=true;const scores=quality.map(p=>mean(history.map(i=>p[i]).filter(finite))),row=publicRows.get(clock[t]);assert.ok(row);
  assert.equal(row.cutoff,base.rows[t].cutoff);assert.equal(row.tradeDate,base.rows[t].tradeDate);
  for(const model of [...families,'adaptive']){
   const allowed=configs.flatMap((c,i)=>model==='adaptive'||c.family===model?[i]:[]);
   allowed.sort((a,b)=>{
    const qa=Math.round(scores[a]*1e12)/1e12,qb=Math.round(scores[b]*1e12)/1e12;
    return (risk?qa-qb:qb-qa)||a-b;
   });
   const ci=allowed[0],c=configs[ci];selected[model][t]=predictions[ci][t];
   const meta=row.methods[model],train=trainAt(t,eligible,target,mature,c.window);
   assert.equal(meta.candidate,c.id);assert.equal(meta.training,train.length);assert.equal(meta.selectionCount,history.length);
   assert.equal(meta.lastTrainingMaturity,mature[train.at(-1)]);assert.ok(meta.lastTrainingMaturity<=row.cutoff);
   assert.equal(meta.selectionLastMaturity,mature[history.at(-1)]);assert.ok(meta.selectionLastMaturity<=row.cutoff);
   equal(scores[ci],meta[risk?'selectionQLIKE':'selectionRankIC']);
   choices[model]||={};choices[model][c.id]=(choices[model][c.id]||0)+1;
   counts.selectionChecks++;
  }
  if(risk)selected['past-risk'][t]=vols[t].map(v=>v*v);
  else {const train=trainAt(t,eligible,target,mature,0);selected.mean[t]=A.map((_,a)=>mean(train.map(i=>y[i][a])));}
  for(const [model,p] of Object.entries(selected))p[t].forEach((v,a)=>equal(v,row.predictions[model][a]));
 }
 assert.equal(ready.filter(Boolean).length,study.forecastRows.length);
 for(const [m,counts] of Object.entries(choices))assert.deepEqual(counts,study.selectionCounts[m]);
 if(risk)selected['past-risk']=vols.map(r=>r.map(v=>finite(v)?v*v:null));
 const common=ready.map((r,t)=>r&&all(y[t])),first=ready.findIndex((r,t)=>r&&all(realised[t])&&finite(cash[t]));
 const mask=clock.map((_,t)=>first>=0&&t>=first&&all(realised[t])&&finite(cash[t]));
 assert.deepEqual(mask,internal.marketMask);
 equal(common.filter(Boolean).length,study.coverage.commonStarts);equal(mask.filter(Boolean).length,study.coverage.holdingMonths);
 const checkStats=(p,published,indices)=>{
  assert.equal(indices.length,published.n);
  if(!indices.length)return;
  assert.equal(clock[indices[0]],published.first);assert.equal(clock[indices.at(-1)],published.last);
  equal(mean(indices.map(i=>risk?loss(p[i],y[i]):rankIC(p[i],y[i]))),published[risk?'meanQLIKE':'meanRankIC']);
 };
 const indices=clock.flatMap((_,i)=>common[i]?[i]:[]),policies={};
 for(const [model,p] of Object.entries(selected)){
  checkStats(p,study.models[model],indices);
  policies[model]=checkPolicy(policy(p,mask,risk?'risk':'tilt'),study.strategies[model]);
  if(!risk)checkPolicy(policy(p,mask,'winner'),study.winnerSensitivity[model]);
 }
 const refs={'SPY':[1,0,0,0,0],'60/40':[.6,.4,0,0,0],'Equal five':[.2,.2,.2,.2,.2]};
 if(!risk)refs['Inverse volatility']=null;
 for(const [model,w] of Object.entries(refs))checkPolicy(policy(clock.map((_,t)=>w||vols[t].map(v=>1/v)),mask,'reference'),study.strategies[model]);
 for(let ci=0;ci<configs.length;ci++){
  const p=predictions[ci],attempt=study.attempts[ci];assert.equal(attempt.id,configs[ci].id);
  checkStats(p,attempt[risk?'risk':'ranking'],indices);
  if(!risk)checkStats(p,attempt.fullCandidateHistory,clock.flatMap((_,i)=>all(p[i])&&all(y[i])?[i]:[]));
  checkPolicy(policy(p,mask,risk?'risk':'tilt'),attempt.policy,false);counts.attemptChecks++;
 }
 for(const [fold,models] of Object.entries(study.folds)){
  const valid=indices.filter(i=>fold==='Through 2019'?clock[i]<'2020':fold==='2020–2022'?clock[i]>='2020'&&clock[i]<'2023':clock[i]>='2023');
  for(const [model,stats] of Object.entries(models))checkStats(selected[model],stats,valid);
 }
 for(const c of study.comparisons){
  const lo=indices[0],hi=indices.at(-1)+1;
  const m=selected[c.model],b=selected.market;
  const a=clock.slice(lo,hi).map((_,k)=>common[lo+k]?(risk?loss(b[lo+k],y[lo+k]):rankIC(m[lo+k],y[lo+k])):null);
  const ref=clock.slice(lo,hi).map((_,k)=>common[lo+k]?(risk?loss(m[lo+k],y[lo+k]):rankIC(b[lo+k],y[lo+k])):null);
  checkBootstrap(a,ref,h,c[risk?'prediction':'ranking']);
  const p=policies[c.model],q=policies.market;
  checkBootstrap(p.map(r=>r.return),q.map(r=>r.return),12,c.policy,true,p.map(r=>r.cash));
  const pm=metrics(p),qm=metrics(q);
  assert.deepEqual(c.economicGates,{higherNetCAGR:pm.cagr>qm.cagr,comparableRisk:pm.volatility<=1.1*qm.volatility,drawdownNoWorse:pm.maxDrawdown>=qm.maxDrawdown});
  assert.equal(c.confirmedEdge,false);
  if((risk&&h===3)||(!risk&&h===12))mainComparisons.push({forecast:c[risk?'prediction':'ranking'],policy:c.policy});
 }
 console.log(JSON.stringify({verified:risk?'risk':cohort,horizon:h,configurations:configs.length,predictions:counts.predictionChecks,selectors:counts.selectionChecks}));
 if(!risk)verifiedStudies[`${h}:${cohort}`]={predictions,configs,eligible,y,mature};
}
function verifyUtility(study,internal,h,cohort){
 const {predictions,configs,eligible,y,mature}=verifiedStudies[`${h}:${cohort}`];
 const families=['market','macro','interaction',...(cohort==='value'?['value-price']:[])];
 const first=clock.findIndex((_,t)=>predictions.every(p=>all(p[t]))&&all(realised[t])&&finite(cash[t]));
 const calendar=clock.map((_,t)=>t>=first&&all(realised[t])&&finite(cash[t]));assert.deepEqual(calendar,internal.candidateCalendar);
 const candidateReturns=predictions.map(p=>{
  const rows=new Map(policy(p,calendar,'tilt').map(r=>[r.month,r.return]));
  return clock.map(m=>rows.get(shift(m,1))??null);
 });
 candidateReturns.forEach((p,ci)=>p.forEach((v,t)=>equal(v,internal.candidateReturns[ci][t])));
 const selected=Object.fromEntries([...families,'adaptive','mean'].map(m=>[m,empty()])),ready=Array(n).fill(false),choices={};
 const publicRows=new Map(study.forecastRows.map(r=>[r.month,r]));
 for(let t=0;t<n;t++){
  if(!predictions.every(p=>all(p[t])))continue;
  const history=clock.flatMap((_,i)=>calendar[i]&&i+1<n&&base.rows[i+1].tradeDate<=base.rows[t].cutoff?[i]:[]).slice(-36);
  if(history.length<24)continue;ready[t]=true;
  const quality=candidateReturns.map(p=>{const x=history.map(i=>p[i]-cash[i]);return sd(x)>1e-12?mean(x)/sd(x)*Math.sqrt(12):-Infinity;});
  const row=publicRows.get(clock[t]);assert.ok(row);
  for(const model of [...families,'adaptive']){
   const allowed=configs.flatMap((c,i)=>model==='adaptive'||c.family===model?[i]:[]);
   allowed.sort((a,b)=>(Math.round(quality[b]*1e12)-Math.round(quality[a]*1e12))||a-b);
   const ci=allowed[0],c=configs[ci],meta=row.methods[model],train=trainAt(t,eligible,y,mature,c.window);
   selected[model][t]=predictions[ci][t];assert.equal(meta.candidate,c.id);
   assert.equal(meta.training,train.length);assert.equal(meta.lastTrainingMaturity,mature[train.at(-1)]);
   assert.equal(meta.selectionCount,history.length);assert.equal(meta.selectionLastMaturity,base.rows[history.at(-1)+1].tradeDate);
   assert.ok(meta.selectionLastMaturity<=row.cutoff);equal(quality[ci],meta.selectionSharpe);counts.selectionChecks++;
   choices[model]||={};choices[model][c.id]=(choices[model][c.id]||0)+1;
  }
  const train=trainAt(t,eligible,y,mature,0);selected.mean[t]=A.map((_,a)=>mean(train.map(i=>y[i][a])));
  for(const [model,p] of Object.entries(selected))p[t].forEach((v,a)=>equal(v,row.predictions[model][a]));
 }
 assert.equal(ready.filter(Boolean).length,study.forecastRows.length);
 for(const [m,c] of Object.entries(choices))assert.deepEqual(c,study.selectionCounts[m]);
 const common=clock.flatMap((_,t)=>ready[t]&&all(y[t])?[t]:[]),start=ready.findIndex((r,t)=>r&&all(realised[t])&&finite(cash[t]));
 const mask=clock.map((_,t)=>t>=start&&all(realised[t])&&finite(cash[t]));assert.deepEqual(mask,internal.marketMask);
 assert.equal(common.length,study.coverage.commonStarts);const policies={};
 for(const [model,p] of Object.entries(selected)){
  equal(mean(common.map(t=>rankIC(p[t],y[t]))),study.models[model].meanRankIC);
  policies[model]=checkPolicy(policy(p,mask,'tilt'),study.strategies[model]);
 }
 for(const [name,w] of Object.entries({'SPY':[1,0,0,0,0],'60/40':[.6,.4,0,0,0],'Equal five':[.2,.2,.2,.2,.2],'Inverse volatility':null}))
  policies[name]=checkPolicy(policy(clock.map((_,t)=>w||vols[t].map(v=>1/v)),mask,'reference'),study.strategies[name]);
 for(const [fold,models] of Object.entries(study.folds))for(const [model,stat] of Object.entries(models)){
  const r=policies[model].filter(r=>fold==='Through 2019'?r.month<'2020':fold==='2020–2022'?r.month>='2020'&&r.month<'2023':r.month>='2023');
  assert.equal(r.length,stat.months);equal(12*mean(r.map(r=>r.return-r.cash)),stat.annualMeanExcess);
 }
 const gates=(a,b)=>({higherNetCAGR:a.cagr>b.cagr,comparableRisk:a.volatility<=1.1*b.volatility,drawdownNoWorse:a.maxDrawdown>=b.maxDrawdown});
 for(const c of study.comparisons){
  const p=policies[c.model],q=policies.market;checkBootstrap(p.map(r=>r.return),q.map(r=>r.return),12,c.policy,true,p.map(r=>r.cash));
  assert.deepEqual(c.economicGates,gates(metrics(p),metrics(q)));assert.deepEqual(c.historicalMeanGates,gates(metrics(p),metrics(policies.mean)));
  assert.equal(c.confirmedEdge,false);if(h===12)utilityComparisons.push(c.policy);
 }
 console.log(JSON.stringify({verified:'portfolio-utility',cohort,horizon:h,selectors:families.length+1}));
}
for(const [h,studies] of Object.entries(data.horizons))for(const [cohort,study] of Object.entries(studies))await verifyStudy(study,audit.studies[h][cohort],+h,cohort,false);
for(const [h,study] of Object.entries(data.risk))await verifyStudy(study,audit.risk[h],+h,'main',true);
for(const [h,studies] of Object.entries(data.portfolioSelection))for(const [cohort,study] of Object.entries(studies))verifyUtility(study,audit.policySelection[h][cohort],+h,cohort);
assert.equal(counts.attemptChecks,data.attemptCount);assert.equal(data.attemptCount,120);
for(const metric of ['forecast','policy']){
 const tests=[...mainComparisons.map(c=>c[metric]),...(metric==='policy'?utilityComparisons:[])];
 const ordered=tests.filter(c=>c.available).sort((a,b)=>a.p-b.p);let last=0;
 ordered.forEach((test,rank)=>{last=Math.min(1,Math.max(last,(tests.length-rank)*test.p));equal(last,test.holmP);});
}
data.audit={status:'Independent source reconstruction passed',...counts,checkedInputSha256:data.inputSha256,
 checkedProtocolSha256:data.protocolSha256,checkedRiskProtocolSha256:data.riskProtocolSha256,checkedPolicyProtocolSha256:data.policyProtocolSha256};
const target=new URL('data/research-lab.json',root),temporary=new URL('data/research-lab.json.tmp',root);
await writeFile(temporary,JSON.stringify(data));await rename(temporary,target);
console.log(JSON.stringify({published:'data/research-lab.json',audit:data.audit}));
