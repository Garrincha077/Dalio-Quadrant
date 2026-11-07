// Independent reconstruction from source macro histories and private return indices.
// Audits every published annual model and objective-aligned forecast; no Python imports.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const report=JSON.parse(fs.readFileSync('data/expanded-periods.json'));
const states=JSON.parse(fs.readFileSync('data/state-forward.json')).points;
const schedule=new Map(JSON.parse(fs.readFileSync('scripts/research/state-vintage-schedule.json')).map(r=>[r.entryMonth,r]));
const shift=(m,n)=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1+n,1)).toISOString().slice(0,7);
const ordinal=m=>+m.slice(0,4)*12+Number(m.slice(5,7));
const close=(a,b,context='')=>assert.ok(Math.abs(a-b)<2e-8,`${context}: ${a} != ${b}`);
const sum=a=>a.reduce((x,y)=>x+y,0);
const quantile=(a,p)=>{const x=[...a].sort((u,v)=>u-v),i=(x.length-1)*p,f=Math.floor(i);return x[f]+(x[Math.ceil(i)]-x[f])*(i-f);};
const wmean=(v,w)=>sum(v.map((n,i)=>n*w[i]))/sum(w);
const revised=new Map(states.map(p=>[p.month,[p.activity,p.inflation]]));
const frames=new Map();
function frame(month,information){
 if(information==='revised')return revised;
 if(frames.has(month))return frames.get(month);
 const s=schedule.get(month);if(!s)return null;
 const file=path.join('work/research/state-vintages',s.cutoff+'.json');if(!fs.existsSync(file))return null;
 const raw=JSON.parse(fs.readFileSync(file));assert.equal(raw.cutoff,s.cutoff);
 const a=new Map(raw.series.CFNAIMA3.observations.filter(r=>r.value!=='.').map(r=>[r.date.slice(0,7),Number(r.value)]));
 const p=new Map(raw.series.PCEPI.observations.filter(r=>r.value!=='.').map(r=>[r.date.slice(0,7),Number(r.value)]));
 const f=new Map();for(const [m,x] of a)if(p.has(m)&&p.has(shift(m,-12)))f.set(m,[x,100*(p.get(m)/p.get(shift(m,-12))-1)]);
 frames.set(month,f);return f;
}
function feature(f,entry){if(!f)return null;const m=shift(entry,-2),rows=[-3,-2,-1,0].map(n=>f.get(shift(m,n)));if(rows.some(r=>!r))return null;return [...rows[3],rows[3][0]-rows[0][0],rows[3][1]-rows[0][1]];}
function expand(x,family){return family==='base'?x.slice(0,5):family==='rates'?x.slice(0,-1):x;}
function estimate(m,x){if(m.spec.family==='unconditional')return 0;const v=expand(x.map((x,i)=>Math.max(m.clipLow[i],Math.min(m.clipHigh[i],x))),m.spec.family);return sum(v.map((x,i)=>(x-m.means[i])/m.scales[i]*m.beta[i]));}
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);const n=b.length;for(let j=0;j<n;j++){let pivot=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i][j])>Math.abs(a[pivot][j]))pivot=i;[a[j],a[pivot]]=[a[pivot],a[j]];const scale=a[j][j];for(let k=j;k<=n;k++)a[j][k]/=scale;for(let i=0;i<n;i++)if(i!==j){const f=a[i][j];for(let k=j;k<=n;k++)a[i][k]-=f*a[j][k];}}return a.map(r=>r[n]);}
let modelChecks=0,forecastChecks=0,selectionChecks=0;
for(const panel of report.panels){
 const manifestFile=`work/research/periods/${panel.panel}-manifest.json`,meta=JSON.parse(fs.readFileSync(manifestFile));
 const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(digest(manifestFile),panel.sourceHashes.manifest);
 if(panel.information==='vintage')assert.equal(digest('work/research/state-vintages/manifest.json'),panel.sourceHashes.macroVintages);
 const assets=Object.keys(meta.assets),prices=new Map(),assetDates=[];
 for(let a=0;a<assets.length;a++){
  const source=meta.assets[assets[a]],file=path.join('work/research/periods',source.prices);assert.equal(digest(file),source.pricesSha256);
  const lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).slice(1).map(l=>l.split(',')),dates=new Map();
  for(const [date,value] of lines){const month=date.slice(0,7),row=prices.get(month)||Array(assets.length).fill(undefined);assert.ok(Number(value)>0);row[a]=Number(value);prices.set(month,row);dates.set(month,date);}assetDates.push(dates);
  assert.equal(lines[0][0].slice(0,7),source.priceStart);assert.equal(lines.at(-1)[0].slice(0,7),source.priceEnd);
 }
 const available=(entry,h,a)=>Array.from({length:h+1},(_,i)=>prices.get(shift(entry,i))?.[a]).every(v=>Number.isFinite(v)&&v>0);
 const clock=[...prices.keys()].sort(),training=new Map(),priceZ=new Map();
 for(const entry of clock)for(let a=0;a<assets.length;a++){
  const values=Array.from({length:36},(_,i)=>prices.get(shift(entry,i-36))?.[a]);
  if(values.some(v=>!Number.isFinite(v)||v<=0))continue;
  const logs=values.map(Math.log),mean=sum(logs)/logs.length,sd=Math.sqrt(sum(logs.map(v=>(v-mean)**2))/(logs.length-1));
  if(sd>=1e-12)priceZ.set(entry+'|'+a,(logs.at(-1)-mean)/sd);
 }
 const rateSources=Object.fromEntries(['GS10','FII10'].map(id=>{const file='work/research/rate-vintages/'+id+'.json';assert.equal(digest(file),report.rateCollection.series.find(s=>s.id===id).sha256);return [id,JSON.parse(fs.readFileSync(file))];})),rateFrames=new Map();
 assert.equal(digest('work/research/rate-vintages/manifest.json'),report.rateCollection.manifestSha256);
 function yieldsAt(refit){
  if(rateFrames.has(refit))return rateFrames.get(refit);
  const ids=panel.cohort==='real'?['GS10','FII10']:['GS10'],cutoff=panel.information==='vintage'?schedule.get(refit)?.cutoff:report.asOf,frames=[];
  for(const id of ids){const raw=rateSources[id],s=panel.information==='vintage'?raw.snapshots[cutoff]:raw.revised;if(!s){rateFrames.set(refit,null);return null;}assert.equal(s.cutoff,cutoff);const values=new Map();for(const r of s.observations){assert.ok(r.date<=cutoff);assert.equal(r.date.slice(8),'01');if(r.value!=='.'&&r.value!==null)values.set(r.date.slice(0,7),Number(r.value));}frames.push(values);}
  rateFrames.set(refit,frames);return frames;
 }
 function joined(f,entry,a,refit=entry){
  const x=feature(f,entry),z=priceZ.get(entry+'|'+a),frames=yieldsAt(refit),trailing=Array.from({length:13},(_,i)=>prices.get(shift(entry,i-13))?.[a]);
  if(!x||z===undefined||!frames||trailing.some(v=>!Number.isFinite(v)||v<=0))return null;
  const yields=frames.map(f=>f.get(shift(entry,-1)));if(yields.some(v=>v===undefined))return null;
  return [...x,z,...yields,trailing.at(-1)/trailing[0]-1];
 }
 const actual=(entry,h,a)=>prices.get(shift(entry,h))[a]/prices.get(entry)[a]*.999/1.001-1;
 function train(model){const key=[model.refitMonth,model.horizon,model.asset].join('|');if(training.has(key))return training.get(key);const a=assets.indexOf(model.asset),f=frame(model.refitMonth,panel.information),rows=[];for(const entry of clock){if(shift(entry,model.horizon)>=model.refitMonth||!available(entry,model.horizon,a))continue;const x=joined(f,entry,a,model.refitMonth);if(x)rows.push({entry,x,y:actual(entry,model.horizon,a)});}training.set(key,rows);return rows;}
 for(const model of Object.values(panel.models)){
  const rows=train(model),s=model.spec,n=rows.length;
  assert.equal(n,model.n);assert.ok(model.lastTrainingExit<model.refitMonth);
  const weights=rows.map(r=>s.halfLife?Math.exp(-Math.log(2)*(ordinal(model.refitMonth)-ordinal(r.entry))/s.halfLife):1),total=sum(weights);weights.forEach((v,i)=>weights[i]=v*n/total);
  close(wmean(rows.map(r=>r.y),weights),model.baseline,'baseline');
  close(sum(weights)**2/sum(weights.map(v=>v*v)),model.effectiveN,'effective N');
  if(s.family!=='unconditional'){
   for(let j=0;j<model.inputCount;j++){close(quantile(rows.map(r=>r.x[j]),.01),model.clipLow[j],'training clip');close(quantile(rows.map(r=>r.x[j]),.99),model.clipHigh[j],'training clip');}
   const expanded=rows.map(r=>expand(r.x.map((v,j)=>Math.max(model.clipLow[j],Math.min(model.clipHigh[j],v))),s.family)),d=expanded[0].length;
   const means=Array.from({length:d},(_,j)=>wmean(expanded.map(r=>r[j]),weights)),scales=means.map((m,j)=>Math.sqrt(wmean(expanded.map(r=>(r[j]-m)**2),weights))||1);
   means.forEach((m,j)=>{close(m,model.means[j],'weighted mean');close(scales[j],model.scales[j],'weighted scale');});
   const z=expanded.map(r=>r.map((v,j)=>(v-means[j])/scales[j]));
   const a=Array.from({length:d},(_,j)=>Array.from({length:d},(_,k)=>sum(z.map((r,i)=>weights[i]*r[j]*r[k]))+(j===k?s.penalty:0)));
   const b=Array.from({length:d},(_,j)=>sum(z.map((r,i)=>weights[i]*r[j]*(rows[i].y-model.baseline))));
   solve(a,b).forEach((v,j)=>close(v,model.beta[j],'independent ridge coefficient'));
  }
  const trainingScores=rows.map(r=>estimate(model,r.x));close(quantile(trainingScores,.75),model.threshold,'training entry threshold');if(model.scorePercentiles)model.scorePercentiles.forEach((v,i)=>close(quantile(trainingScores,i/20),v,'training rank percentile'));modelChecks++;
 }
 for(const target of panel.targets){
  const a=assets.indexOf(target.asset);
  const refs=new Map(target.refits.map(f=>[f.refitMonth.slice(0,4),f]));
  const actuals=target.forecasts.map(r=>r.actual),means={};
  for(const row of target.forecasts){
   if(panel.panel==='etf'&&panel.information==='vintage')assert.equal(assetDates[a].get(row.entry),schedule.get(row.entry).tradeDate);
   assert.ok(available(row.entry,target.horizon,a));const f=frame(row.entry,panel.information),x=joined(f,row.entry,a);
   assert.ok(x);x.forEach((v,i)=>close(v,row.x[i],'dated macro/lagged price feature'));
   close(actual(row.entry,target.horizon,a),row.actual,'actual forward return');forecastChecks++;
  }
  for(const policy of report.stages){
   const selected=target.forecasts.filter(row=>{const m=panel.models[refs.get(row.entry.slice(0,4)).models[policy]],s=estimate(m,row.x);return s>1e-12&&s>=m.threshold-1e-12;});
   const result=target.results[policy];assert.equal(selected.length,result.selectedStarts);assert.equal(result.nScored,actuals.length);
   means[policy]=selected.length?sum(selected.map(r=>r.actual))/selected.length:null;
   if(selected.length){close(means[policy],result.mean,'selected mean');close(means[policy]-sum(actuals)/actuals.length,result.lift,'selected lift');}
   else assert.equal(result.lift,null);
  }
  for(const [family,r] of Object.entries(target.incremental)){
   if(means[r.left]===null||means[r.right]===null)assert.equal(r.gain,null);
   else close(means[r.left]-means[r.right],r.gain,'paired nested-stage gain');
  }
  for(const f of target.refits){
   for(const family of report.stages){
    if(f.fallback){assert.equal(panel.models[f.models[family]].spec.id,family+':100:0');}
    else{
     assert.ok(f.lastValidationExit<f.refitMonth);assert.ok(f.folds>=3&&f.nValidation>=24);
     const viable=f.candidates.filter(c=>c.family===family&&c.entryStarts>=12&&c.entryEpisodes>=3&&c.entryLift>0).sort((a,b)=>b.entryLift-a.entryLift||(a.id<b.id?-1:a.id>b.id?1:0));
     assert.equal(panel.models[f.models[family]].spec.id,viable[0]?.id??'unconditional');
    }selectionChecks++;
   }
  }
 }
}
console.log(`Independent extended-period audit passed: ${modelChecks} fitted parameter sets, ${forecastChecks} dated yield/trend rows and ${selectionChecks} chronological family selections.`);
