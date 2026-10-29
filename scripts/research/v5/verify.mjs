import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {completedWeeks,weeklyRsi,classifyBottoming,signalIncrease,BOTTOMING_RULES} from '../../../lib/bottoming.mjs';
const root=new URL('../../../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const hash=async p=>createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');
const data=await read('work/research-v5/research-candidate.json'),manifest=await read('work/research-v5/source-manifest.json');
assert.equal(data.protocolSha256,await hash('scripts/research/v5/protocol.md'));
assert.equal(data.sourceManifestSha256,await hash('work/research-v5/source-manifest.json'));
assert.deepEqual(data.rules,BOTTOMING_RULES);assert.equal(data.rsiPeriod,14);assert.equal(data.confirmedEdge,false);
for(const source of data.sources)assert.equal(await hash(source.file),source.sha256);
assert.equal(await hash('work/research-v2/features.json'),data.macroInputSha256);
assert.equal(await hash('work/research-v3/features.json'),data.scoreInputSha256);
const finite=Number.isFinite,mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const close=(a,b)=>{if(!finite(a)){assert.equal(b,null);return;}assert.ok(finite(b)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(a)),`${a} != ${b}`);};
const now=new Date(`${data.asOf}T23:59:59.999Z`);
function prices(payload,symbol){
 const x=payload.chart.result[0];assert.equal(x.meta.symbol,symbol);assert.equal(x.meta.dataGranularity,'1d');
 const raw=x.indicators.quote[0].close,adj=x.indicators.adjclose?.[0]?.adjclose||raw,seen=new Set();
 return x.timestamp.flatMap((t,i)=>{
  const date=new Date(t*1000).toISOString().slice(0,10);if(date>data.asOf||raw[i]===null||adj[i]===null)return [];
  assert.ok(!seen.has(date)&&raw[i]>0&&adj[i]>0);seen.add(date);return [{date,value:raw[i],adjusted:adj[i]}];
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
const index=prices(await read('work/research-v5/sp500-daily.json'),'^GSPC'),spy=prices(await read('work/research-v5/spy-daily.json'),'SPY');
const weeks=new Map(weeklyRsi(completedWeeks(index,now)).map(r=>[r.week,r]));
const lookup=new Map(spy.map((r,i)=>[r.date,i]));
const rawVix=(await readFile(new URL('work/research-v5/cboe-vix.csv',root),'utf8')).trim().split(/\r?\n/);
const headers=rawVix.shift().split(','),vix=new Map(rawVix.map(l=>l.split(',')).map(r=>{
 const [m,d,y]=r[headers.indexOf('DATE')].split('/');return [`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,+r[headers.indexOf('CLOSE')]];
}));
const fred=Object.fromEntries(await Promise.all(['VIXCLS','BAMLH0A0HYM2'].map(async id=>[id,await read(`work/research-v5/fred/${id}.json`)])));
function original(id,cutoff,date){
 if(!fred[id].cutoffs.includes(cutoff)||date>cutoff)return null;
 const r=fred[id].observations.find(r=>r.date===date),value=r?.[`${id}_${cutoff.replaceAll('-','')}`];
 return value!==undefined&&value!=='.'&&finite(+value)?+value:null;
}
const macro=(await read('work/research-v2/features.json')).rows,scores=(await read('work/research-v3/features.json')).rows;
const counts={rsiChecks:0,classificationChecks:0,vintageChecks:0,entryChecks:0,outcomeChecks:0,summaryChecks:0};
let previous=null;
for(const row of data.weeks){
 assert.ok(row.week>='2003-09-22'&&row.week<=data.asOf);const w=weeks.get(row.week);assert.equal(w.date,row.priceDate);
 close(w.rsi,row.rsi);counts.rsiChecks++;
 const following=spy.filter(p=>p.date>row.week);assert.equal(following[1].date,row.executionDate);
 const cutoff=new Date(`${row.executionDate}T00:00:00Z`);cutoff.setUTCDate(cutoff.getUTCDate()-1);assert.equal(cutoff.toISOString().slice(0,10),row.cutoff);
 const snapshot=fred.VIXCLS.cutoffs.includes(row.cutoff);
 close(snapshot?original('VIXCLS',row.cutoff,row.priceDate):vix.get(row.priceDate),row.vix);
 close(original('BAMLH0A0HYM2',row.cutoff,row.priceDate),row.hy);counts.vintageChecks+=2;
 const c=classifyBottoming(row);for(const k of ['level','lower','upper','complete'])assert.equal(c[k],row[k]);counts.classificationChecks++;
 assert.equal(c.complete&&snapshot,row.fullEligible);assert.equal(signalIncrease(previous,c),row.newSignal);previous=c;
 const m=macro.filter(r=>r.cutoff<=row.cutoff).at(-1),v=scores.filter(r=>r.cutoff<=row.cutoff).at(-1);
 assert.equal(row.context.macroCutoff,m?.cutoff??null);assert.equal(row.context.scoreCutoff,v?.cutoff??null);
 for(const [k,expected] of Object.entries({activity:m?.activity,inflationGap:m?.inflationGap,growthMomentum:m?.growth,
  inflationMomentum:m?.inflation,spyValueZ:v?.assets.SPY.value.z,spyPriceZ:v?.assets.SPY.price.z}))close(expected,row.context[k]);
}
const archiveBytes=await readFile(new URL('work/research-v5/hy-user-archive.csv',root));
assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${archiveBytes.length}\0`),archiveBytes])).digest('hex'),'fee6be14d5322d7402826f1ea2d03de5a475ac0d');
assert.equal(data.archiveProtocolSha256,await hash('scripts/research/v5/archive-protocol.md'));
const archiveLines=archiveBytes.toString().trimEnd().split(/\r?\n/);assert.equal(archiveLines.shift(),'date,BAMLH0A0HYM2');
let lastDate='',blanks=0,matched=0,maxDiff=0,crossings=0;const archive=new Map();
for(const line of archiveLines){const [date,raw]=line.split(',');assert.ok(date>lastDate&&date<='2026-02-11');assert.equal(new Date(date).toISOString().slice(0,10),date);lastDate=date;
 const value=raw.trim()===''?null:Number(raw);if(value===null)blanks++;else assert.ok(finite(value)&&value>=0);archive.set(date,value);
 const reference=original('BAMLH0A0HYM2',data.asOf,date);if(value!==null&&reference!==null){matched++;maxDiff=Math.max(maxDiff,Math.abs(value-reference));for(const t of [4.5,6,8])crossings+=(value>=t)!==(reference>=t);}
}
assert.ok(matched>=100&&maxDiff<=.02&&crossings===0);
for(const [k,v] of Object.entries({rows:archive.size,blanks,nonmissing:archive.size-blanks,matched,maxAbsoluteDifferencePercentagePoints:maxDiff,thresholdCrossings:crossings}))assert.equal(data.archiveReceipt[k],v);
assert.equal(data.originalCandidateSha256,await hash('work/research-v5/original-candidate.json'));
const before=await read('work/research-v5/original-candidate.json');
assert.deepEqual(data.weeks,before.weeks);assert.deepEqual(data.latest,before.latest);for(const cohort of ['full','two'])assert.deepEqual(data.studies[cohort],before.studies[cohort]);
assert.equal(data.archiveWeeks.length,data.weeks.length);previous=null;
for(let i=0;i<data.archiveWeeks.length;i++){const row=data.archiveWeeks[i],base=data.weeks[i];
 const fromOriginal=fred.BAMLH0A0HYM2.cutoffs.includes(row.cutoff);const hy=fromOriginal?original('BAMLH0A0HYM2',row.cutoff,row.priceDate):archive.get(row.priceDate)??null;
 for(const k of ['week','priceDate','cutoff','executionDate','rsi','vix','context'])assert.deepEqual(row[k],base[k]);close(hy,row.hy);counts.vintageChecks++;
 const c=classifyBottoming({...row,hy});for(const k of ['level','lower','upper','complete'])assert.equal(c[k],row[k]);
 assert.equal(row.hySource,fromOriginal?'FRED original vintage':'User-provided retrospective FRED archive');
 assert.equal(c.complete,row.archiveEligible);assert.equal(signalIncrease(previous,c),row.newSignal);previous=c;counts.classificationChecks++;
}
const predicates={full:{level1:r=>r.level>=1,level2:r=>r.level>=2,level3:r=>r.level===3,
 rsi:r=>r.rsi<=40,vix:r=>r.vix>=25,hy:r=>r.hy>=4.5},two:{both1:r=>r.rsi<=40&&r.vix>=25,
 both2:r=>r.rsi<=33&&r.vix>=30,rsi:r=>r.rsi<=40,vix:r=>r.vix>=25}};
predicates.archive=predicates.full;
function outcome(entry,h){
 const i=lookup.get(entry.executionDate);if(i+h>=spy.length)return null;
 const ratio=spy[i+h].adjusted/spy[i].adjusted;
 const mae=Math.min(...spy.slice(i,i+h+1).map(r=>r.adjusted/spy[i].adjusted-1));
 return {endDate:spy[i+h].date,grossReturn:ratio-1,netReturn:ratio*.999**2-1,stressReturn:ratio*.9975**2-1,mae};
}
function checkSummary(rows,actual){
 const a=rows.filter(r=>r.status==='included');assert.equal(a.length,actual.n);
 const values=a.map(r=>r.netReturn).sort((a,b)=>a-b),median=a.length?(values[Math.floor((a.length-1)/2)]+values[Math.ceil((a.length-1)/2)])/2:null;
 const expected={meanNetReturn:a.length?mean(values):null,medianNetReturn:median,positiveShare:a.length?a.filter(r=>r.netReturn>0).length/a.length:null,
  meanStressReturn:a.length?mean(a.map(r=>r.stressReturn)):null,meanMAE:a.length?mean(a.map(r=>r.mae)):null,
  worstMAE:a.length?Math.min(...a.map(r=>r.mae)):null};
 for(const [k,v] of Object.entries(expected))close(v,actual[k]);
 assert.equal(rows.filter(r=>r.status==='overlap skipped').length,actual.overlapSkipped);
 assert.equal(rows.filter(r=>r.status==='not yet mature').length,actual.unmatured);counts.summaryChecks++;
}
for(const [cohort,study] of Object.entries(data.studies)){
 const sourceWeeks=cohort==='archive'?data.archiveWeeks:data.weeks;
 const available=r=>cohort==='full'?r.fullEligible:cohort==='archive'?r.archiveEligible:finite(r.rsi)&&finite(r.vix);
 const eligible=sourceWeeks.filter(available);
 assert.equal(eligible.length,study.eligibleWeeks);assert.equal(eligible[0].week,study.first);assert.equal(eligible.at(-1).week,study.last);
 for(const [key,predicate] of Object.entries(predicates[cohort])){
  let prior=null,lastWeek=null;const entries=[];
  for(const row of sourceWeeks){
   const valid=available(row)?predicate(row):null,consecutive=lastWeek&&Date.parse(row.week)-Date.parse(lastWeek)===7*86400000;
   if(valid&&prior===false&&consecutive)entries.push(row);prior=valid;lastWeek=row.week;
  }
  const rule=study.rules[key];assert.equal(rule.setupEpisodes,entries.length);
  for(const h of data.horizons){
   const result=rule.horizons[h];assert.equal(entries.length,result.entries.length);let lastEnd=-1;
   const expected=entries.map((entry,k)=>{
    const row=result.entries[k];assert.equal(row.week,entry.week);assert.equal(row.executionDate,entry.executionDate);
    assert.ok(entry.cutoff<entry.executionDate);counts.entryChecks++;
    const i=lookup.get(entry.executionDate);let values,status;
    if(i<lastEnd)status='overlap skipped';else{lastEnd=i+h;values=outcome(entry,h);status=values?'included':'not yet mature';}
    assert.equal(row.status,status);
    if(values){assert.equal(values.endDate,row.endDate);for(const k of ['grossReturn','netReturn','stressReturn','mae'])close(values[k],row[k]);counts.outcomeChecks++;}
    return {...values,status};
   });
   checkSummary(expected,result.stats);
  }
 }
 for(const h of data.horizons){
  const rows=eligible.map(r=>{const values=outcome(r,h);return {...values,status:values?'included':'not yet mature'};});
  checkSummary(rows,study.unconditional[h]);
 }
}
const latest=data.latest,l=classifyBottoming(latest);close(weeks.get(latest.week).rsi,latest.rsi);
close(original('VIXCLS',data.asOf,latest.priceDate),latest.vix);close(original('BAMLH0A0HYM2',data.asOf,latest.priceDate),latest.hy);
for(const k of ['level','lower','upper','complete'])assert.equal(l[k],latest[k]);
data.audit={status:'Independent source reconstruction passed',...counts,archiveMatchedDays:matched,archiveThresholdCrossings:crossings,checkedArchiveProtocolSha256:data.archiveProtocolSha256,checkedProtocolSha256:data.protocolSha256,checkedSourceManifestSha256:data.sourceManifestSha256};
const temporary=new URL('data/bottoming.json.tmp',root);await writeFile(temporary,JSON.stringify(data));await rename(temporary,new URL('data/bottoming.json',root));
console.log(JSON.stringify({published:'data/bottoming.json',audit:data.audit}));
