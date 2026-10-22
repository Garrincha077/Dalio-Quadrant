import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {zbin,shortZ,event,summary,calendar} from '../scripts/research/v10/verify.mjs';
test('shock z bins and short-price reference have exact causal boundaries',()=>{
 assert.deepEqual([-1.01,-1,0,1,null].map(zbin),['<-1','-1 to 0','0 to 1','>=1','missing']);const p=Array.from({length:253},(_,i)=>Math.exp(i/252));assert.equal(shortZ(p,251),null);const a=shortZ(p,252);p[252]*=2;assert.ok(shortZ(p,252)>a);assert.equal(shortZ(Array(253).fill(1),252),null);
});
test('first observed L3 never backdates stress memory or resets within a crisis',()=>{
 const rows=Array.from({length:180},(_,i)=>({week:'2020-01-03',executionDate:'2020-01-07',cutoff:'2020-01-06',complete:true,level:i===5||i===10?3:i===0?1:0,rsi:50,vix:20,hy:4}));const r=calendar(rows,[],[]);assert.equal(r[0].memory,'none');assert.equal(r[5].weeksSinceL3,0);assert.equal(r[10].weeksSinceL3,5);assert.equal(r.filter(x=>x.firstL3).length,1);assert.equal(r[162].memory,'none');assert.equal(r[5].dashboard,'missing');
});
test('shock outcome requires exact execution prices, both fees and the actual daily adverse path',()=>{
 const p=[{date:'2020-01-07',adjusted:100},{date:'2020-01-10',adjusted:60},{date:'2020-01-14',adjusted:120}],map=new Map(p.map((r,i)=>[r.date,i])),cal=[{executionDate:'2020-01-07',complete:true,cashReturn:.001},{executionDate:'2020-01-14',complete:true,cashReturn:null}],r=event(p,map,cal,0,1);assert.ok(Math.abs(r[0]-(1.2*.999/1.001-1))<1e-12);assert.ok(Math.abs(r[4]+.4)<1e-12);assert.ok(Math.abs(r[2]-.001)<1e-12);assert.equal(event(p,new Map(),cal,0,1),null);
});
test('horizon spacing preserves the first date rather than selecting the best outcome',()=>{
 const e=[.1,.9,.2,.3,.4].map(v=>[v,v,0,v,-.1,v]),cal=e.map(()=>({level:0,cluster:null,l3Cluster:null})),s=summary([0,1,4],e,cal,3,.3);assert.equal(s[1],2);assert.equal(s[13],.25);
});
test('published shock research keeps missing outcomes, all assets and source disagreements visible',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/shock-asset-research.json',import.meta.url)));assert.equal(d.audit.status,'Independent shock, regime and asset reconstruction passed');assert.equal(d.confirmedEdge,false);assert.equal(Object.keys(d.assets).length,5);assert.equal(d.calendar.filter(r=>r.firstL3).length,2);assert.equal(d.calendar.filter(r=>r.level===3).length,10);
 assert.equal(d.sources.filter(r=>r.monthlyCheck.status==='needs-review').length,3);for(const a of Object.keys(d.assets)){assert.equal(d.studies[a][156].events.length,d.calendar.length);assert.equal(d.studies[a][156].events.at(-1),null);for(const p of d.primaryComparisons[a]){assert.equal(p.l3Clusters,2);assert.equal(p.p,null);assert.equal(p.holmP,null);}for(const h of d.horizons)assert.ok(Object.keys(d.studies[a][h].cells).length===12);}
});
