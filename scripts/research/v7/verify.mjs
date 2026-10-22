import {packPolicies,policyRows} from '../../../lib/research-paths.mjs';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {writeFile,rename} from 'node:fs/promises';
import {root,read,hash,finite,mean,sd,same,close,reconstruct,policy,folds,quantile} from '../v6/verify.mjs';
import {solve} from '../v3/independent-math.mjs';
export const models={mean:[],past52:[],past13:[],market:[0,1],vix:[2],stress:[0,1,2,3],price:[0,1,2,3,4],full:Array.from({length:10},(_,i)=>i)};
export const qlike=(actual,predicted)=>actual/predicted-Math.log(actual/predicted)-1;
export function fit(training,target,current,names){
 const width=current.length,columns=current.map((_,j)=>training.map(r=>r[j])),means=columns.map(mean),sds=columns.map(c=>{const v=sd(c);return v>1e-12?v:1;});
 const transform=row=>row.map((v,j)=>Math.max(-5,Math.min(5,(v-means[j])/sds[j]))),x=training.map(transform),now=transform(current),logy=target.map(Math.log),intercept=mean(logy);
 const gram=Array.from({length:width},()=>Array(width).fill(0)),cross=Array(width).fill(0);
 for(let i=0;i<x.length;i++)for(let j=0;j<width;j++){cross[j]+=x[i][j]*(logy[i]-intercept);for(let k=0;k<width;k++)gram[j][k]+=x[i][j]*x[i][k];}
 const predictions={},details={};
 for(const name of names){const cols=models[name];let raw,detail={coefficients:[],calibration:null};
  if(name==='mean')raw=mean(target);else if(name==='past52'||name==='past13')raw=Math.exp(current[name==='past13'?0:1]);
  else{const beta=solve(cols.map(j=>cols.map(k=>gram[j][k]+(j===k?10:0))),cols.map(j=>cross[j]));
   const calibration=mean(target.map((y,i)=>y/Math.exp(intercept+cols.reduce((s,j,k)=>s+x[i][j]*beta[k],0))));
   raw=Math.exp(intercept+cols.reduce((s,j,k)=>s+now[j]*beta[k],0))*calibration;detail={coefficients:beta,calibration,intercept};}
  predictions[name]=Math.max(.0001,Math.min(1,raw));details[name]={...detail,boundHit:raw<.0001||raw>1};
 }
 return {predictions,detail:{means,sds,models:details}};
}
export function summary(rows,model,cal){
 const a=rows.filter(r=>finite(r.target)),target=a.map(r=>r.target),pred=a.map(r=>r.predictions[model]),order=pred.map((_,i)=>i).sort((i,j)=>pred[i]-pred[j]),buckets=[];
 // numpy.array_split distributes one extra item to each early bucket.
 let at=0;for(let k=0;k<4;k++){const count=Math.floor(order.length/4)+(k<order.length%4?1:0),ids=order.slice(at,at+count);at+=count;if(count)buckets.push({n:count,meanPredictedVolatility:mean(ids.map(i=>Math.sqrt(pred[i]))),observedVolatility:Math.sqrt(mean(ids.map(i=>target[i])))});}
 return {n:a.length,first:a.length?cal[a[0].i].week:null,last:a.length?cal[a.at(-1).i].week:null,
  meanQLIKE:a.length?mean(target.map((y,i)=>qlike(y,pred[i]))):null,volatilityMAE:a.length?mean(target.map((y,i)=>Math.abs(Math.sqrt(y)-Math.sqrt(pred[i])))):null,
  actualPredictedRatio:a.length?mean(target.map((y,i)=>y/pred[i])):null,buckets,boundHits:rows.filter(r=>r.boundHits[model]).length};
}
export function blockTest(a,b,starts){
 const diff=a.map((v,i)=>v-b[i]),valid=diff.filter(finite);if(valid.length<104)return {available:false,n:valid.length,reason:'Insufficient paired mature starts'};
 const observed=mean(valid),draws=[];for(const row of starts){let sum=0,n=0,count=0;for(const start of row)for(let k=0;k<52&&count<diff.length;k++,count++){const v=diff[(start+k)%diff.length];if(finite(v)){sum+=v;n++;}}if(n)draws.push(sum/n);}
 return {available:true,n:valid.length,difference:observed,lower95:quantile(draws,.025),upper95:quantile(draws,.975),
  p:(1+draws.filter(v=>Math.abs(v-observed)>=Math.abs(observed)-1e-12).length)/(draws.length+1),replications:draws.length,blockWeeks:52};
}
export async function verify(){
 const data=await read('work/research-v7/research-candidate.json'),base=await read('data/recovery-research.json'),privateFits=await read('work/research-v7/private-fits.json'),draws=await read('work/research-v7/bootstrap-starts.json');
 assert.equal(base.audit.status,'Independent reconstruction passed');assert.equal(data.protocolSha256,await hash('scripts/research/v7/protocol.md'));assert.equal(data.recoveryInputSha256,await hash('data/recovery-research.json'));assert.equal(data.confirmedEdge,false);
 const {calendar:cal,spy}=await reconstruct(),x=cal.map((r,i)=>[Math.log(base.memory.calendar[i].shortVol**2),Math.log(r.pastVol**2),r.vix>0?Math.log((r.vix/100)**2):NaN,r.hy>0?Math.log(r.hy):NaN,r.priceZ,r.valueZ,r.context.activity,r.context.inflationGap,r.growth,r.inflation]);
 const audit={targetChecks:0,trainingChecks:0,refitChecks:0,predictionChecks:0,policyChecks:0,summaryChecks:0,bootstrapChecks:0,procedureChecks:0};const comparisons=[];
 for(const h of [4,13,52]){
  const target=cal.map((_,i)=>i+h<cal.length?52*mean(cal.slice(i,i+h).map(r=>r.marketReturn**2)):null),maturity=cal.map((_,i)=>cal[i+h]?.executionDate??null);
  for(const [cohort,width,count] of [['main',4,6],['price',5,7],['context',10,8]]){
   const names=Object.keys(models).slice(0,count),eligible=x.map(row=>row.slice(0,width).every(finite)),study=data.horizons[h][cohort],forecasts=[],fits=privateFits[h][cohort];
   for(let i=0;i<cal.length;i++){
    if(!eligible[i])continue;const train=cal.flatMap((_,j)=>j<i&&eligible[j]&&maturity[j]&&maturity[j]<=cal[i].cutoff&&finite(target[j])?[j]:[]).slice(-520);if(train.length<104)continue;
    const actual=study.forecasts[forecasts.length],record=fits[forecasts.length];assert.equal(actual.i,i);assert.equal(actual.trainingCount,train.length);assert.equal(actual.lastTrainingMaturity,maturity[train.at(-1)]);assert.ok(actual.lastTrainingMaturity<=cal[i].cutoff);assert.deepEqual(record.training,train);audit.trainingChecks++;
    close(target[i],actual.target);assert.equal(actual.maturityDate,maturity[i]);audit.targetChecks++;
    const rebuilt=fit(train.map(j=>x[j].slice(0,width)),train.map(j=>target[j]),x[i].slice(0,width),names);
    same(rebuilt.detail,{means:record.means,sds:record.sds,models:record.models});same(rebuilt.predictions,actual.predictions);audit.refitChecks+=names.filter(n=>models[n].length).length;audit.predictionChecks+=names.length;
    for(const name of names)assert.equal(rebuilt.detail.models[name].boundHit,actual.boundHits[name]);forecasts.push({...actual,predictions:rebuilt.predictions});
   }
   assert.equal(forecasts.length,study.forecasts.length);assert.equal(fits.length,forecasts.length);assert.equal(study.calendarStartIndex,forecasts[0].i);assert.deepEqual(study.models,names);
   const lookup=new Map(forecasts.map(r=>[r.i,r])),first=forecasts[0].i;assert.equal(study.cashFallbackIntervals,cal.slice(first,-1).filter(r=>!lookup.has(r.i)).length);
   for(const name of names){const expected=summary(forecasts,name,cal);expected.folds={};for(const [label,start,end] of folds){const sub=forecasts.filter(r=>cal[r.i].week.slice(0,4)>=start&&cal[r.i].week.slice(0,4)<end);if(sub.length)expected.folds[label]=summary(sub,name,cal);}same(expected,study.summaries[name]);audit.summaryChecks+=1+Object.keys(expected.folds).length;
    const alt=cal.map(r=>({...r,riskCap:lookup.has(r.i)?Math.min(1,.1/Math.sqrt(lookup.get(r.i).predictions[name])):0}));const p=policy(alt,spy,first,'market',[]);p.kind='forecast-risk';same(p,study.strategies[name]);audit.policyChecks+=p.rows.length;audit.procedureChecks++;
   }
   if(cohort==='main'&&[4,52].includes(h)){
    const length=cal.length-first,loss=Object.fromEntries(names.map(n=>[n,Array(length).fill(NaN)]));for(const r of forecasts)if(finite(r.target))for(const name of names)loss[name][r.i-first]=qlike(r.target,r.predictions[name]);
    const starts=draws[h];assert.equal(starts.length,2500);for(const row of starts){assert.equal(row.length,Math.ceil(length/52));for(const v of row)assert.ok(Number.isInteger(v)&&v>=0&&v<length);}
    for(const [model,ref] of [['stress','market'],['stress','past13'],['stress','past52'],['stress','vix'],['vix','market']]){
     const t={horizon:h,model,reference:ref,...blockTest(loss[ref],loss[model],starts),foldGains:{}};
     for(const label of Object.keys(study.summaries[model].folds)){const a=study.summaries[model].folds[label],b=study.summaries[ref].folds[label];if(a.n)t.foldGains[label]=b.meanQLIKE-a.meanQLIKE;}
     comparisons.push(t);audit.bootstrapChecks++;
    }
   }
  }
 }
 let last=0;for(const [rank,t] of [...comparisons].sort((a,b)=>(a.p??1)-(b.p??1)).entries())if(t.available){last=Math.min(1,Math.max(last,(10-rank)*t.p));t.holmP=last;}same(comparisons,data.primaryComparisons);
 for(const h of [4,52]){const tests=comparisons.filter(t=>t.horizon===h),strong=t=>t.available&&t.lower95>0&&t.holmP<.05&&Object.values(t.foldGains).every(v=>v>0),s=data.horizons[h].main;
  assert.equal(s.strongerRiskSupport,tests.filter(t=>t.model==='stress'&&t.reference!=='vix').every(strong));assert.equal(s.incrementalHYSupport,tests.filter(t=>t.model==='stress').every(strong));assert.equal(s.vixVsMarketSupport,tests.filter(t=>t.model==='vix').every(strong));}
 assert.equal(audit.procedureChecks,63);data.audit={status:'Independent refits and reconstruction passed',...audit,protocolSha256:data.protocolSha256};
 const packed=packPolicies(data,{risk:true});for(const [h,cohorts] of Object.entries(data.horizons))for(const [cohort,study] of Object.entries(cohorts))for(const key of study.models)assert.deepEqual(policyRows(packed.horizons[h][cohort].strategies[key],packed,cal),study.strategies[key].rows);
 let shards=0;
 for(const [h,cohorts] of Object.entries(packed.horizons))for(const [cohort,study] of Object.entries(cohorts)){
  const path=`data/risk-paths-${h}-${cohort}.json`,payload={version:'risk-policy-paths-7',horizon:h,cohort,rows:Object.fromEntries(study.models.map(m=>[m,study.strategies[m].rows]))};
  const body=JSON.stringify(payload),digest=createHash('sha256').update(body).digest('hex');
  const temporary=new URL(path+'.tmp',root);await writeFile(temporary,body);await rename(temporary,new URL(path,root));assert.equal(await hash(path),digest);
  study.policyPathReceipt={path:'/'+path,sha256:digest};for(const m of study.models)delete study.strategies[m].rows;shards++;
 }
 packed.audit.policyShardChecks=shards;data.audit.policyShardChecks=shards;
 const tmp=new URL('data/risk-research.json.tmp',root);await writeFile(tmp,JSON.stringify(packed));await rename(tmp,new URL('data/risk-research.json',root));console.log(JSON.stringify(data.audit));return data;
}
if(process.argv[1]&&new URL(process.argv[1],'file://').href===import.meta.url)await verify();
