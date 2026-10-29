import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyBottoming as classify,completedWeeks,weeklyRsi,weeklyBottomingSnapshot,signalIncrease} from '../lib/bottoming.mjs';
import {loadBottoming} from '../lib/bottoming-live.mjs';
import handler from '../api/bottoming.js';
const weekly=(values,start='2026-01-02')=>values.map((value,i)=>({week:new Date(Date.parse(start)+i*7*86400000).toISOString().slice(0,10),value}));
const now=new Date('2026-05-02T12:00:00Z');
const prices=weekly(Array.from({length:18},(_,i)=>100+i)).map(r=>({date:r.week,value:r.value}));
test('inclusive screenshot thresholds require any two for L1 and L2',()=>{
 assert.equal(classify({rsi:40,vix:25,hy:1}).level,1);
 assert.equal(classify({rsi:80,vix:30,hy:6}).level,2);
 assert.equal(classify({rsi:33,vix:1,hy:6}).level,2);
 assert.equal(classify({rsi:80,vix:25,hy:1}).level,0);
});
test('L3 requires all three; highest satisfied level wins without a sequence',()=>{
 assert.equal(classify({rsi:30,vix:40,hy:8}).level,3);
 assert.equal(classify({rsi:31,vix:40,hy:8}).level,2);
 assert.equal(classify({rsi:30,vix:39.99,hy:8}).level,2);
 assert.equal(classify({rsi:30,vix:40,hy:7.99}).level,2);
});
test('missing data produces bounds rather than a fabricated zero',()=>{
 assert.deepEqual(['level','lower','upper'].map(k=>classify()[k]),[null,0,3]);
 const c=classify({rsi:30,vix:40});assert.equal(c.level,null);assert.equal(c.lower,2);assert.equal(c.upper,3);
});
test('partial inputs can determine a level but remain incomplete',()=>{
 const c=classify({rsi:33,vix:30});assert.equal(c.level,2);assert.equal(c.complete,false);
 for(const bad of [-1,101,NaN,Infinity,'30'])assert.equal(classify({rsi:bad}).inputs.rsi,null);
 assert.equal(classify({hy:0}).inputs.hy,0);
});
test('daily closes aggregate to the final session and exclude unfinished weeks',()=>{
 const rows=completedWeeks([{date:'2026-04-23',value:10},{date:'2026-04-24',value:11},{date:'2026-04-30',value:12}],new Date('2026-05-01T18:00:00Z'));
 assert.deepEqual(rows,[{week:'2026-04-24',date:'2026-04-24',value:11}]);
 assert.throws(()=>completedWeeks([{date:'2026-04-24',value:1},{date:'2026-04-24',value:2}],now),/Duplicate/);
});
test('Wilder RSI uses a seeded mean and recursive smoothing',()=>{
 const rows=weeklyRsi(weekly([100,110,105,115,110]),2);
 assert.equal(rows[1].rsi,null);assert.ok(Math.abs(rows[2].rsi-66.6666666667)<1e-8);
 assert.ok(Math.abs(rows[3].rsi-85.7142857143)<1e-8);assert.ok(Math.abs(rows[4].rsi-54.5454545455)<1e-8);
});
test('RSI handles flat, all-up and all-down series',()=>{
 assert.equal(weeklyRsi(weekly(Array(15).fill(100))).at(-1).rsi,50);
 assert.equal(weeklyRsi(weekly(Array.from({length:15},(_,i)=>100+i))).at(-1).rsi,100);
 assert.equal(weeklyRsi(weekly(Array.from({length:15},(_,i)=>100-i))).at(-1).rsi,0);
});
test('missing weeks reset the RSI seed',()=>{
 const rows=weekly([1,2,3,4]);rows[3].week='2026-02-06';assert.equal(weeklyRsi(rows,2).at(-1).rsi,null);
});
test('new signals occur only on increases between complete known levels',()=>{
 assert.equal(signalIncrease({complete:true,level:1},{complete:true,level:1}),false);
 assert.equal(signalIncrease({complete:true,level:0},{complete:true,level:2}),true);
 assert.equal(signalIncrease({complete:false,level:0},{complete:true,level:2}),false);
 assert.equal(signalIncrease(null,{complete:true,level:2}),false);
});
test('weekly snapshot requires exact session dates and rejects stale index history',()=>{
 const last=prices.at(-1).date;
 const c=weeklyBottomingSnapshot({prices,vix:[{date:last,value:'25'}],hy:[{date:'2026-04-23',value:'5'}],now});
 assert.equal(c.readings.hy.value,null);assert.equal(c.complete,false);assert.equal(c.priceDate,last);
 assert.throws(()=>weeklyBottomingSnapshot({prices,now:new Date('2026-06-01')}),/stale/);
});
function mockFetch({vix='20',hy='3',granularity='1d',failed=null}={}){
 return async url=>{url=new URL(url);const id=url.searchParams.get('series_id');
  if(id){if(id===failed)return new Response('down',{status:503});return Response.json({observations:[{date:prices.at(-1).date,value:id==='VIXCLS'?vix:hy}]});}
  return Response.json({chart:{result:[{meta:{symbol:'^GSPC',dataGranularity:granularity},timestamp:prices.map(p=>Date.parse(p.date)/1000),indicators:{quote:[{close:prices.map(p=>p.value)}]}}]}});
 };
}
test('server refresh joins all three sources and exposes no credential',async()=>{
 const s=await loadBottoming('private-test-key',{now,fetchImpl:mockFetch()});
 assert.equal(s.fetchStatus.received,3);assert.equal(s.level,0);assert.equal(s.complete,true);assert.ok(!JSON.stringify(s).includes('private-test-key'));
});
test('one unavailable FRED source remains visibly partial',async()=>{
 const s=await loadBottoming('key',{now,fetchImpl:mockFetch({failed:'BAMLH0A0HYM2'})});
 assert.equal(s.complete,false);assert.equal(s.fetchStatus.code,'PARTIAL_WEEKLY_DATA');assert.equal(s.inputs.hy,null);
});
test('monthly index payload cannot silently produce weekly RSI',async()=>{
 await assert.rejects(loadBottoming('key',{now,fetchImpl:mockFetch({granularity:'1mo'})}),/unavailable/);
});
test('API refuses unsupported mutations without fetching sources',async()=>{
 const headers={};const res={setHeader:(k,v)=>headers[k]=v,status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST'},res);assert.equal(res.code,405);assert.equal(headers.Allow,'GET');
});
test('published evidence keeps source cohorts, original rules and low event counts visible',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/bottoming.json',import.meta.url)));
 assert.equal(d.confirmedEdge,false);assert.equal(d.archiveReceipt.matched,601);assert.equal(d.archiveReceipt.thresholdCrossings,0);
 assert.ok(d.studies.archive.eligibleWeeks>d.studies.full.eligibleWeeks);assert.equal(d.studies.archive.rules.level3.horizons[252].stats.n,2);
 assert.equal(d.studies.archive.rules.level3.horizons[252].stats.worstMAE<-.3,true);
 assert.equal(d.studies.full.rules.level3.horizons[252].stats.meanNetReturn,null);
});
