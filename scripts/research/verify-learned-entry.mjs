// Independent reconstruction from source macro histories and private return indices.
// Audits every published annual model and objective-aligned forecast; no Python imports.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const report=JSON.parse(fs.readFileSync('data/learned-entry.json'));
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
function expand(x,curved){return curved?[...x,x[0]**2,x[1]**2,x[0]*x[1]]:x;}
function estimate(m,x){const s=m.spec;if(s.family==='unconditional')return 0;if(s.family==='fixed'||s.family==='calibrated'){const a=x[0]-s.a,p=x[1]-s.p;return Math.abs(a)<=1e-9||Math.abs(p)<=1e-9?0:m.cellScores[(a>0?2:0)+(p>0?1:0)];}const v=expand(x.map((x,i)=>Math.max(m.clipLow[i],Math.min(m.clipHigh[i],x))),s.family==='curved');return sum(v.map((x,i)=>(x-m.means[i])/m.scales[i]*m.beta[i]));}
function solve(a,b){a=a.map((r,i)=>[...r,b[i]]);const n=b.length;for(let j=0;j<n;j++){let pivot=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i][j])>Math.abs(a[pivot][j]))pivot=i;[a[j],a[pivot]]=[a[pivot],a[j]];const scale=a[j][j];for(let k=j;k<=n;k++)a[j][k]/=scale;for(let i=0;i<n;i++)if(i!==j){const f=a[i][j];for(let k=j;k<=n;k++)a[i][k]-=f*a[j][k];}}return a.map(r=>r[n]);}
let modelChecks=0,forecastChecks=0,selectionChecks=0;
for(const panel of report.panels){
 const meta=JSON.parse(fs.readFileSync(`work/research/extended/${panel.panel}-manifest.json`));
 const lines=fs.readFileSync(path.join('work/research/extended',meta.prices),'utf8').trim().split(/\r?\n/).map(l=>l.split(','));
 const assets=lines.shift().slice(1,-1),prices=new Map(lines.map(r=>[r[0].slice(0,7),r.slice(1,-1).map(Number)]));
 const clock=[...prices.keys()].sort(),training=new Map();
 const actual=(entry,h,a)=>prices.get(shift(entry,h))[a]/prices.get(entry)[a]*.999/1.001-1;
 function train(model){const key=[model.refitMonth,model.horizon,model.asset].join('|');if(training.has(key))return training.get(key);const a=assets.indexOf(model.asset),f=frame(model.refitMonth,panel.information),rows=[];for(const entry of clock){if(shift(entry,model.horizon)>=model.refitMonth||!prices.has(shift(entry,model.horizon)))continue;const x=feature(f,entry);if(x)rows.push({entry,x,y:actual(entry,model.horizon,a)});}training.set(key,rows);return rows;}
 for(const model of Object.values(panel.models)){
  const rows=train(model),s=model.spec,n=rows.length;
  assert.equal(n,model.n);assert.ok(model.lastTrainingExit<model.refitMonth);
  const weights=rows.map(r=>s.halfLife?Math.exp(-Math.log(2)*(ordinal(model.refitMonth)-ordinal(r.entry))/s.halfLife):1),total=sum(weights);weights.forEach((v,i)=>weights[i]=v*n/total);
  close(wmean(rows.map(r=>r.y),weights),model.baseline,'baseline');
  close(sum(weights)**2/sum(weights.map(v=>v*v)),model.effectiveN,'effective N');
  if(s.family==='fixed'||s.family==='calibrated')for(let q=0;q<4;q++){
   let numerator=0,count=0;rows.forEach((r,i)=>{const a=r.x[0]-s.a,p=r.x[1]-s.p;if(Math.abs(a)>1e-9&&Math.abs(p)>1e-9&&(a>0?2:0)+(p>0?1:0)===q){count+=weights[i];numerator+=weights[i]*(r.y-model.baseline);}});close(numerator/(count+24),model.cellScores[q],'pooled quadrant');
  }
  else if(s.family!=='unconditional'){
   for(let j=0;j<4;j++){close(quantile(rows.map(r=>r.x[j]),.01),model.clipLow[j],'training clip');close(quantile(rows.map(r=>r.x[j]),.99),model.clipHigh[j],'training clip');}
   const expanded=rows.map(r=>expand(r.x.map((v,j)=>Math.max(model.clipLow[j],Math.min(model.clipHigh[j],v))),s.family==='curved')),d=expanded[0].length;
   const means=Array.from({length:d},(_,j)=>wmean(expanded.map(r=>r[j]),weights)),scales=means.map((m,j)=>Math.sqrt(wmean(expanded.map(r=>(r[j]-m)**2),weights))||1);
   means.forEach((m,j)=>{close(m,model.means[j],'weighted mean');close(scales[j],model.scales[j],'weighted scale');});
   const z=expanded.map(r=>r.map((v,j)=>(v-means[j])/scales[j]));
   const a=Array.from({length:d},(_,j)=>Array.from({length:d},(_,k)=>sum(z.map((r,i)=>weights[i]*r[j]*r[k]))+(j===k?s.penalty:0)));
   const b=Array.from({length:d},(_,j)=>sum(z.map((r,i)=>weights[i]*r[j]*(rows[i].y-model.baseline))));
   solve(a,b).forEach((v,j)=>close(v,model.beta[j],'independent ridge coefficient'));
  }
  close(quantile(rows.map(r=>estimate(model,r.x)),.75),model.threshold,'training entry threshold');modelChecks++;
 }
 for(const target of panel.targets){
  const a=assets.indexOf(target.asset);
  for(const row of target.selectedForecasts){
   const f=frame(row.entry,panel.information),x=feature(f,row.entry),m=panel.models[row.model];
   assert.ok(m.refitMonth<=row.entry);assert.equal(m.refitMonth.slice(0,4),row.entry.slice(0,4));
   x.forEach((v,i)=>close(v,row.x[i],'actual signal features'));
   close(actual(row.entry,target.horizon,a),row.actual,'actual forward return');
   close(estimate(m,x),row.score,'forecast');
   const entered=row.score>1e-12&&row.score>=m.threshold-1e-12;assert.equal(entered,row.enter);forecastChecks++;
  }
  for(const f of target.refits){
   if(f.fallback){assert.equal(panel.models[f.models.timing_selected].spec.id,'linear:100:0');}
   else{
    assert.ok(f.lastValidationExit<f.refitMonth);assert.ok(f.folds>=3&&f.nValidation>=24);
    const viable=f.candidates.filter(c=>c.entryStarts>=12&&c.entryEpisodes>=3&&c.entryLift>0).sort((a,b)=>b.entryLift-a.entryLift||(a.id<b.id?-1:a.id>b.id?1:0));
    assert.equal(panel.models[f.models.timing_selected].spec.id,viable[0]?.id??'unconditional');
   }selectionChecks++;
  }
 }
}
console.log(`Independent learned-model audit passed: ${modelChecks} fitted parameter sets, ${forecastChecks} dated entry forecasts and ${selectionChecks} chronological selections.`);
