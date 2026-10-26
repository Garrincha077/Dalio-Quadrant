// Independent audit of every conditional mean, baseline, count and exported leading episode.
// No Python analysis functions or precomputed forward-return labels are used.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const report=JSON.parse(fs.readFileSync(new URL('../../data/entry-opportunities.json',import.meta.url)));
const stateData=JSON.parse(fs.readFileSync(new URL('../../data/state-forward.json',import.meta.url)));
const states=new Map(stateData.points.map(p=>[p.month,p]));
const shift=(m,n)=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1+n,1)).toISOString().slice(0,7);
const ord=m=>+m.slice(0,4)*12+Number(m.slice(5,7));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const q=(a,p)=>Math.abs(a)<=1e-9||Math.abs(p-2)<=1e-9?'boundary':`${a>0?'above':'below'}-${p>2?'above':'below'}`;
const dir=(d,b)=>d>b+1e-9?'rising':d< -b-1e-9?'falling':'flat';
const distance=(v,near,outer)=>Math.abs(v)<=near+1e-9?'near':Math.abs(v)<=outer+1e-9?'intermediate':'distant';
function feature(m){
 const p=[-3,-2,-1,0].map(n=>states.get(shift(m,n)));
 if(p.some(r=>!r||!Number.isFinite(r.activity)||!Number.isFinite(r.inflation)))return null;
 const a=p[3].activity,y=p[3].inflation;
 return {state:q(a,y),trend:dir(a-p[0].activity,.1)+'/'+dir(y-p[0].inflation,.2),distance:distance(a,.1,.5)+'/'+distance(y-2,.2,2)};
}
const key=(r,f)=>r.state+(f==='state'?'':'|'+r.trend)+(f==='state-trend-distance'?'|'+r.distance:'');
function episodes(rows){
 let previous=null;const result=[];
 for(const row of rows){if(previous===null||row.entry!==shift(previous,1))result.push([]);result.at(-1).push(row);previous=row.entry;}
 return result;
}
const quantile=(a,p)=>{const x=[...a].sort((u,v)=>u-v),i=(x.length-1)*p,f=Math.floor(i);return x[f]+(x[Math.ceil(i)]-x[f])*(i-f);};
let checked=0,episodeChecks=0,temporalChecks=0;
for(const panel of report.panels){
 const manifestFile=path.resolve('work/research/extended',panel.name+'-manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestFile));
 const csv=fs.readFileSync(path.resolve(path.dirname(manifestFile),manifest.prices),'utf8').trim().split(/\r?\n/).map(l=>l.split(','));
 const assets=csv.shift().slice(1,-1);
 const prices=new Map(csv.filter(row=>row[0].slice(0,7)<report.asOf.slice(0,7)).map(row=>[row[0].slice(0,7),row.slice(1,-1).map(Number)]));
 const dates=[...prices.keys()].sort(),cache={};
 for(const h of report.horizons){
  const rows=[];
  for(const entry of dates){
   const exit=shift(entry,h),reference=shift(entry,-2),f=feature(reference);
   if(!f||!prices.has(exit))continue;
   if(Array.from({length:h+1},(_,i)=>shift(entry,i)).some(m=>!prices.has(m)))continue;
   const returns=assets.map((_,j)=>prices.get(exit)[j]/prices.get(entry)[j]*.999/1.001-1);
   rows.push({entry,exit,reference,...f,returns});
  }
  cache[h]=rows;
  assert.equal(rows.length,panel.cohorts[h].n);
  assert.equal(rows[0].entry,panel.cohorts[h].firstEntry);
  for(const cell of panel.cells.filter(c=>c.horizon===h)){
   const a=assets.indexOf(cell.asset),selected=rows.filter(r=>key(r,cell.family)===cell.condition),values=selected.map(r=>r.returns[a]);
   const base=mean(rows.map(r=>r.returns[a]));
   assert.equal(selected.length,cell.n);close(mean(values),cell.mean);close(base,cell.baseline);close(mean(values)-base,cell.lift);
   close(quantile(values,.5),cell.median);close(quantile(values,.1),cell.p10);close(values.filter(v=>v<0).length/values.length,cell.lossFrequency);
   const groups=episodes(selected);assert.equal(groups.length,cell.episodes);
   let previous=null,count=0;
   for(const r of selected)if(previous===null||ord(r.entry)-ord(previous)>=h){count++;previous=r.entry;}
   assert.equal(count,cell.nonoverlappingStarts);
   assert.equal(cell.supported,cell.n>=24&&cell.episodes>=6);
   if(panel.leadingEpisodes[cell.id]){
    const exported=panel.leadingEpisodes[cell.id];assert.equal(exported.length,groups.length);
    groups.forEach((g,i)=>{assert.equal(g[0].reference,exported[i].firstReference);assert.equal(g.at(-1).entry,exported[i].lastEntry);assert.equal(g.length,exported[i].starts);close(mean(g.map(r=>r.returns[a])),exported[i].meanReturn);episodeChecks++;});
   }
   checked++;
  }
 }
 for(const t of panel.temporal){
  const rows=cache[t.horizon],a=assets.indexOf(t.asset),dev=rows.filter(r=>r.exit<t.split),later=rows.filter(r=>r.entry>=t.split),base=mean(dev.map(r=>r.returns[a]));
  const candidates=[...new Set(dev.map(r=>key(r,t.family)))].filter(k=>!k.startsWith('boundary')).map(k=>{
   const picked=dev.filter(r=>key(r,t.family)===k);
   return {key:k,rows:picked,lift:mean(picked.map(r=>r.returns[a]))-base,episodes:episodes(picked).length};
  }).filter(x=>x.rows.length>=24&&x.episodes>=6).sort((x,y)=>y.lift-x.lift||x.key.localeCompare(y.key));
  assert.equal(t.condition,candidates[0]?.key??null);
  if(t.condition){close(t.developmentLift,candidates[0].lift);const selected=later.filter(r=>key(r,t.family)===t.condition);assert.equal(selected.length,t.laterConditionN);if(selected.length)close(t.laterLift,mean(selected.map(r=>r.returns[a]))-mean(later.map(r=>r.returns[a])));}
  temporalChecks++;
 }
}
console.log(`Independent source audit passed: ${checked} condition cells, ${episodeChecks} leading episodes, ${temporalChecks} temporal selections.`);
