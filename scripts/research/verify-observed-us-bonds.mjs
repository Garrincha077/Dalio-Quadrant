// Independent issuer-risk, fixed-rule, outcome and temporal-summary reconstruction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const report=JSON.parse(fs.readFileSync('data/observed-us-bonds.json'));
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
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

const folder='work/research/ief-risk',manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
assert.equal(digest(path.join(folder,'manifest.json')),report.quality.collectionManifestSha256);
assert.equal(digest('work/research/state-vintages/manifest.json'),report.macroManifestSha256);
assert.equal(digest('work/research/prices/IEF.csv'),report.priceSourceSha256);
const sourceRisks=new Map();let riskChecks=0,rowChecks=0,ruleChecks=0;
for(const source of manifest.snapshots){
 const file=path.join(folder,source.date+'.json');assert.equal(digest(file),source.sha256);
 const raw=JSON.parse(fs.readFileSync(file));assert.equal(raw.productId,239456);
 const f=raw.componentsByNameMap.holdings.containersByNameMap.all.dataPointsByNameMap;
 assert.equal(String(f.asOfDate.value),source.date.replaceAll('-',''));
 const w=f.holdingPercent.value,eligible=w.map((v,i)=>[v,i]).filter(([v,i])=>v>0&&f.assetClass.value[i]==='Fixed Income'&&String(f.cusip.value[i]).startsWith('912'));
 const total=sum(eligible.map(([v])=>v)),net=sum(w),good=eligible.filter(([v,i])=>Number.isFinite(f.duration.value[i])&&f.duration.value[i]>0&&Number.isFinite(f.yieldToMaturity.value[i]));
 const covered=sum(good.map(([v])=>v));
 if(total<95||total>105||net<95||net>105||covered<.99*total){assert.ok(report.quality.invalidRisk.some(r=>r.date===source.date));continue;}
 const y=sum(good.map(([v,i])=>v*f.yieldToMaturity.value[i]))/covered,d=sum(good.map(([v,i])=>v*f.duration.value[i]))/covered;
 const month=source.date.slice(0,7),r=report.quality.riskRows.find(r=>r.month===month);assert.ok(r);
 close(y,r.ytm,'sleeve YTM');close(d,r.duration,'sleeve duration');close(y/d,r.cushion,'carry cushion');close(total,r.treasuryWeight);close(covered/total,r.riskCoverage);
 sourceRisks.set(month,{...r,ytm:y,duration:d,cushion:y/d});riskChecks++;
}
assert.equal(sourceRisks.size,report.quality.riskValidMonths);
const lines=fs.readFileSync('work/research/prices/IEF.csv','utf8').trim().split(/\r?\n/).map(l=>l.split(',')),header=lines.shift(),col=header.indexOf('adjusted close');
const market=new Map(lines.filter(r=>r[0].slice(0,7)<report.asOf.slice(0,7)).map(r=>[r[0].slice(0,7),Number(r[col])])),clock=[...market.keys()].sort();
assert.equal(digest(path.join(folder,'performance.json')),manifest.performanceSha256);
const perf=JSON.parse(fs.readFileSync(path.join(folder,'performance.json'))).componentsByNameMap.performance.containersByNameMap.chart.dataPointsByNameMap.performanceData;
const nav=new Map(perf.asOfDate.map((d,i)=>[String(d).slice(0,4)+'-'+String(d).slice(4,6),Number(perf.value[i])]).filter(([m])=>market.has(m)));
function riskAt(entry,mode){
 const m=shift(entry,-2),risk=sourceRisks.get(m);if(!risk||shift(m,-60)<[...sourceRisks.keys()].sort()[0])return null;
 const values=Array.from({length:60},(_,i)=>sourceRisks.get(shift(m,i-60))),count=values.filter(Boolean).length;let gap=0,longest=0;
 for(const v of values){gap=v?0:gap+1;longest=Math.max(longest,gap);}
 if(mode==='complete60'?count!==60:count<48||longest>6)return null;
 return {...risk,medianCushion:quantile(values.filter(Boolean).map(v=>v.cushion),.5),referenceCount:count};
}
function available(prices,entry,h){return Array.from({length:h+1},(_,i)=>prices.get(shift(entry,i))).every(v=>Number.isFinite(v)&&v>0);}
function result(rows,rule){const chosen=rows.filter(r=>r.policies[rule].enter),normal=rows.length?sum(rows.map(r=>r.actual))/rows.length:null,mean=chosen.length?sum(chosen.map(r=>r.actual))/chosen.length:null;return {nScored:rows.length,selectedStarts:chosen.length,mean,lift:mean===null?null:mean-normal};}
function check(rows,rules){for(const [rule,r] of Object.entries(rules)){const a=result(rows,rule);assert.equal(a.nScored,r.nScored);assert.equal(a.selectedStarts,r.selectedStarts);if(a.mean===null){assert.equal(r.mean,null);assert.equal(r.lift,null);}else{close(a.mean,r.mean,'selected mean');close(a.lift,r.lift,'selected lift');}}}
for(const target of report.targets){
 const prices=target.returnBasis==='market'?market:nav,lookup=new Map(target.records.map(r=>[r.entry,r]));
 for(const entry of clock){
  const risk=riskAt(entry,target.referenceMode),macro=feature(frame(entry,target.information),entry);
  const eligible=!!risk&&!!macro&&available(prices,entry,target.horizon);assert.equal(lookup.has(entry),eligible,'Full eligibility '+entry);
  if(!eligible)continue;const row=lookup.get(entry);macro.forEach((v,i)=>close(v,row.macro[i],'dated macro input'));
  assert.equal(row.risk.date,risk.date);close(row.risk.cushion,risk.cushion);close(row.risk.medianCushion,risk.medianCushion);assert.equal(row.risk.referenceCount,risk.referenceCount);
  const carry=risk.cushion>risk.medianCushion+1e-9,disinflation=carry&&macro[3]<-.2-1e-9,masks={carry,disinflation,weak:disinflation&&macro[0]<-1e-9};
  for(const rule of report.rules){assert.equal(row.policies[rule].enter,masks[rule]);ruleChecks++;}
  close(prices.get(shift(entry,target.horizon))/prices.get(entry)*.999/1.001-1,row.actual,'net outcome');
  if(row.diagnostic){const a=sourceRisks.get(row.entry),b=sourceRisks.get(row.exit),d=row.diagnostic;assert.equal(target.horizon,12);close(a.ytm/100,d.carry);close(-a.duration*(b.ytm-a.ytm)/100,d.durationShock);close(d.carry+d.durationShock,d.approximateReturn);close(d.actualBeforeEntryExitCost-d.approximateReturn,d.residual);}
  rowChecks++;
 }
 check(target.records,target.results);
 for(const segment of target.segments)check(target.records.filter(r=>r.entry>=segment.start&&r.entry<segment.endExclusive),segment.results);
 for(const r of Object.values(target.incremental)){const left=result(target.records,r.left),right=result(target.records,r.right);if(left.mean===null||right.mean===null)assert.equal(r.gain,null);else close(left.mean-right.mean,r.gain,'paired gain');}
}
console.log(`Independent US issuer audit passed: ${riskChecks} risk snapshots, ${rowChecks} eligible rows and ${ruleChecks} fixed-rule decisions.`);
