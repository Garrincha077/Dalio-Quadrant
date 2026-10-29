import assert from 'node:assert/strict';import {writeFile,rename} from 'node:fs/promises';
import {root,read,hash,finite,mean,sd,same,reconstruct,policy,priceRows,gates,bootstrap} from '../v6/verify.mjs';
import {completedWeeks} from '../../../lib/bottoming.mjs';import {solve} from '../v3/independent-math.mjs';import {blockTest} from '../v7/verify.mjs';import {packPolicies,policyRows} from '../../../lib/research-paths.mjs';
export const models={mean:[],market:Array.from({length:4},(_,i)=>i),stress:Array.from({length:7},(_,i)=>i),price:Array.from({length:8},(_,i)=>i),full:Array.from({length:13},(_,i)=>i)};
export function utilityWeight(expected,variance,cap){return finite(expected)&&finite(variance)&&variance>0?Math.min(cap,Math.max(0,expected/(3*variance))):0;}
export function fit(training,target,current,names){
 const columns=current.map((_,j)=>training.map(r=>r[j])),means=columns.map(mean),sds=columns.map(c=>{const s=sd(c);return s>1e-12?s:1;}),scale=r=>r.map((v,j)=>Math.max(-5,Math.min(5,(v-means[j])/sds[j])));
 const x=training.map(scale),q=scale(current),intercept=mean(target),width=current.length,gram=Array.from({length:width},()=>Array(width).fill(0)),cross=Array(width).fill(0);
 for(let i=0;i<x.length;i++)for(let j=0;j<width;j++){cross[j]+=x[i][j]*(target[i]-intercept);for(let k=0;k<width;k++)gram[j][k]+=x[i][j]*x[i][k];}
 const predictions={},details={};for(const name of names){const cols=models[name],beta=cols.length?solve(cols.map(j=>cols.map(k=>gram[j][k]+(j===k?100:0))),cols.map(j=>cross[j])):[];
  const raw=intercept+cols.reduce((s,j,k)=>s+q[j]*beta[k],0);predictions[name]=Math.max(-.5,Math.min(.5,raw));details[name]={coefficients:beta,boundHit:raw<-.5||raw>.5};}
 return {predictions,detail:{means,sds,intercept,models:details}};
}
export function summary(rows,model,cal){
 const a=rows.filter(r=>finite(r.target)),y=a.map(r=>r.target),p=a.map(r=>r.predictions[model]),base=a.map(r=>r.predictions.mean),error=p.map((v,i)=>v-y[i]);
 return {n:a.length,first:a.length?cal[a[0].i].week:null,last:a.length?cal[a.at(-1).i].week:null,mse:a.length?mean(error.map(v=>v*v)):null,
  mae:a.length?mean(error.map(Math.abs)):null,bias:a.length?mean(error):null,directionAccuracy:a.length?mean(p.map((v,i)=>(v>0)===(y[i]>0)?1:0)):null,
  r2VsMean:a.length?1-error.reduce((s,v)=>s+v*v,0)/base.reduce((s,v,i)=>s+(v-y[i])**2,0):null,boundHits:rows.filter(r=>r.boundHits[model]).length};
}
const folds=[['Through 2010','0000','2011'],['2011–2019','2011','2020'],['2020–2022','2020','2023'],['2023 onward','2023','9999']];
export async function verify(){
 const d=await read('work/research-v9/research-candidate.json'),risk=await read('data/risk-research.json'),fits=await read('work/research-v9/private-fits.json'),draws=await read('work/research-v9/bootstrap-starts.json'),{calendar:cal,spy}=await reconstruct();
 for(const [file,key] of [['scripts/research/v9/protocol.md','protocolSha256'],['data/risk-research.json','riskInputSha256'],['data/recovery-research.json','recoveryInputSha256']])assert.equal(await hash(file),d[key]);
 const now=new Date(`${d.asOf}T23:59:59.999Z`),iw=completedWeeks(priceRows(await read('work/research-v5/sp500-daily.json'),'^GSPC',d.asOf),now),sw=completedWeeks(spy.map(r=>({date:r.date,value:r.adjusted})),now),im=new Map(iw.map((r,i)=>[r.week,i])),sm=new Map(sw.map((r,i)=>[r.week,i]));
 const near=new Map(risk.horizons[4].main.forecasts.map(r=>[r.i,r.predictions.vix]));
 const x=cal.map(r=>{const j=im.get(r.week),k=sm.get(r.week),v=sd(sw.slice(k-13,k+1).slice(1).map((p,i)=>p.value/sw[k-13+i].value-1))*Math.sqrt(52);
  return [Math.log(iw[j].value/iw[j-13].value),Math.log(iw[j].value/iw[j-52].value),Math.log(v*v),Math.log(r.pastVol**2),r.rsi/100-.5,r.vix>0?Math.log((r.vix/100)**2):null,r.hy>0?Math.log(r.hy):null,r.priceZ,r.valueZ,r.context.activity,r.context.inflationGap,r.growth,r.inflation];});
 const target=cal.map((_,i)=>i+52<cal.length?cal.slice(i,i+52).reduce((p,r)=>p*(1+r.marketReturn),1)-cal.slice(i,i+52).reduce((p,r)=>p*(1+r.cashReturn),1):null),maturity=cal.map((_,i)=>cal[i+52]?.executionDate??null);
 const audit={trainingChecks:0,targetChecks:0,refitChecks:0,predictionChecks:0,policyChecks:0,summaryChecks:0,procedureChecks:0,policyProcedureChecks:0,bootstrapChecks:0};const rebuilt={};
 for(const [cohort,width,count] of [['main',7,3],['price',8,4],['context',13,5]]){
  const names=Object.keys(models).slice(0,count),eligible=x.map(r=>r.slice(0,width).every(finite)),study=d.cohorts[cohort],forecasts=[];assert.deepEqual(study.models,names);
  for(let i=0;i<cal.length;i++){
   if(!eligible[i]||!near.has(i))continue;const train=cal.flatMap((_,j)=>j<i&&eligible[j]&&maturity[j]&&maturity[j]<=cal[i].cutoff&&finite(target[j])?[j]:[]).slice(-520);if(train.length<156)continue;
   const row=study.forecasts[forecasts.length],stored=fits[cohort][forecasts.length];assert.equal(row.i,i);assert.deepEqual(stored.training,train);assert.equal(row.trainingCount,train.length);assert.equal(row.lastTrainingMaturity,maturity[train.at(-1)]);assert.ok(row.lastTrainingMaturity<=cal[i].cutoff);same(target[i],row.target);assert.equal(row.maturityDate,maturity[i]);same(near.get(i),row.nearTermVariance);
   same(x[i].slice(0,width),stored.currentFeatures);const actual=fit(train.map(j=>x[j].slice(0,width)),train.map(j=>target[j]),x[i].slice(0,width),names);same(actual.predictions,row.predictions);same(actual.detail,{means:stored.means,sds:stored.sds,intercept:stored.intercept,models:stored.models});
   for(const m of names)assert.equal(row.boundHits[m],actual.detail.models[m].boundHit);forecasts.push({...row,predictions:actual.predictions});audit.trainingChecks++;audit.targetChecks++;audit.refitChecks+=names.length-1;audit.predictionChecks+=names.length;
  }
  assert.equal(forecasts.length,study.forecasts.length);assert.equal(forecasts.length,fits[cohort].length);const first=forecasts[0].i;assert.equal(study.calendarStartIndex,first);assert.equal(study.holdingIntervals,cal.length-1-first);const lookup=new Map(forecasts.map(r=>[r.i,r]));assert.equal(study.cashFallbackIntervals,cal.slice(first,-1).filter(r=>!lookup.has(r.i)).length);rebuilt[cohort]={forecasts,strategies:{}};
  for(const m of names){const s=summary(forecasts,m,cal);s.folds={};for(const [label,start,end] of folds){const sub=forecasts.filter(r=>cal[r.i].week.slice(0,4)>=start&&cal[r.i].week.slice(0,4)<end);if(sub.length)s.folds[label]=summary(sub,m,cal);}same(s,study.summaries[m]);audit.summaryChecks+=1+Object.keys(s.folds).length;audit.procedureChecks++;
   for(const mode of ['sign','utility']){
    const clock=cal.map(r=>{const p=lookup.get(r.i),mu=p?.predictions[m],w=p?(mode==='sign'?(mu>0?r.riskCap:0):utilityWeight(mu,p.nearTermVariance,r.riskCap)):0;return {...r,riskCap:w};});
    const p=policy(clock,spy,first,'market',[]);p.kind=mode;p.rule=m;same(p,study.strategies[`${mode}:${m}`]);rebuilt[cohort].strategies[`${mode}:${m}`]=p;audit.policyChecks+=p.rows.length;audit.policyProcedureChecks++;
   }
  }
  for(const key of ['passive','risk-only']){const clock=cal.map(r=>({...r,riskCap:key==='passive'?r.riskCap:near.has(r.i)?Math.min(r.riskCap,.1/Math.sqrt(near.get(r.i))):0}));const p=policy(clock,spy,first,'market',[]);p.kind=key;same(p,study.strategies[key]);rebuilt[cohort].strategies[key]=p;audit.policyChecks+=p.rows.length;audit.policyProcedureChecks++;}
  for(const [key,s] of Object.entries(study.strategies)){if(!key.includes(':'))continue;const mode=key.split(':')[0],g=Object.fromEntries([`${mode}:mean`,`${mode}:market`,'passive','risk-only'].map(ref=>[ref,gates(s,study.strategies[ref])]));same(g,s.gates);assert.equal(s.practicalCandidate,Object.values(g).every(v=>v.higherReturn||v.defensiveTradeoff));assert.equal(s.confirmedEdge,false);}
 }
 const main=d.cohorts.main,first=main.calendarStartIndex,length=cal.length-first,loss=Object.fromEntries(main.models.map(m=>[m,Array(length).fill(NaN)]));
 for(const r of rebuilt.main.forecasts)if(finite(r.target))for(const m of main.models)loss[m][r.i-first]=(r.target-r.predictions[m])**2;
 function validateDraws(starts,n){assert.equal(starts.length,2500);for(const row of starts){assert.equal(row.length,Math.ceil(n/52));for(const i of row)assert.ok(Number.isInteger(i)&&i>=0&&i<n);}}
 validateDraws(draws.prediction,length);validateDraws(draws.policy,length-1);const predictions=[],policies=[];
 for(const ref of ['mean','market']){const t={model:'stress',reference:ref,...blockTest(loss[ref],loss.stress,draws.prediction),foldGains:{}};
  for(const label of Object.keys(main.summaries.stress.folds)){const a=main.summaries.stress.folds[label],b=main.summaries[ref].folds[label];if(a.n)t.foldGains[label]=b.mse-a.mse;}predictions.push(t);audit.bootstrapChecks++;
 }
 const cash=cal.slice(first,-1).map(r=>r.cashReturn),s=rebuilt.main.strategies;
 for(const mode of ['sign','utility'])for(const ref of [`${mode}:mean`,`${mode}:market`,'passive','risk-only']){const model=`${mode}:stress`,a=s[model],b=s[ref],t={model,reference:ref,...bootstrap(a.rows.map(r=>r.return),b.rows.map(r=>r.return),cash,draws.policy),foldGains:{}};for(const label of Object.keys(a.folds))t.foldGains[label]=a.folds[label].annualMeanExcess-b.folds[label].annualMeanExcess;policies.push(t);audit.bootstrapChecks++;}
 for(const tests of [predictions,policies]){let last=0;for(const [rank,t] of [...tests].sort((a,b)=>(a.p??1)-(b.p??1)).entries())if(t.available!==false){last=Math.min(1,Math.max(last,(tests.length-rank)*t.p));t.holmP=last;}}
 same(predictions,d.predictionComparisons);same(policies,d.policyComparisons);
 for(const mode of ['sign','utility']){const a=main.strategies[`${mode}:stress`];assert.equal(a.strongerSupport,!!(a.practicalCandidate&&policies.filter(t=>t.model===`${mode}:stress`).every(t=>t.lower95>0&&t.holmP<.05&&Object.values(t.foldGains).every(v=>v>0))));}
 assert.equal(audit.procedureChecks,12);assert.equal(audit.policyProcedureChecks,30);assert.equal(d.confirmedEdge,false);d.audit={status:'Independent return refits and allocations passed',...audit};const packed=packPolicies(d);for(const [c,study] of Object.entries(d.cohorts))for(const key of Object.keys(study.strategies))assert.deepEqual(policyRows(packed.cohorts[c].strategies[key],packed),study.strategies[key].rows);
 const tmp=new URL('data/return-research.json.tmp',root);await writeFile(tmp,JSON.stringify(packed));await rename(tmp,new URL('data/return-research.json',root));console.log(JSON.stringify(d.audit));return d;
}
if(process.argv[1]&&new URL(process.argv[1],'file://').href===import.meta.url)await verify();
