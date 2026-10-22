import {packPolicies,policyRows} from '../../../lib/research-paths.mjs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {completedWeeks,weeklyRsi,classifyBottoming} from '../../../lib/bottoming.mjs';
export const root=new URL('../../../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
export const hash=async p=>createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');
export const finite=Number.isFinite,day=s=>Date.parse(`${s}T00:00:00Z`)/86400000;
export const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
export const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
export const close=(a,b)=>{if(a===null||a===undefined||!finite(a)){assert.equal(b,null);return;}assert.ok(finite(b)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(a)),`${a} != ${b}`);};
export function same(a,b){if(typeof a==='number'||a===null){close(a,b);return;}if(Array.isArray(a)){assert.equal(a.length,b.length);a.forEach((v,i)=>same(v,b[i]));return;}if(a&&typeof a==='object'){for(const k of Object.keys(a))same(a[k],b[k]);return;}assert.equal(a,b);}
export const folds=[['Through 2010','0000','2011'],['2011–2019','2011','2020'],['2020–2022','2020','2023'],['2023 onward','2023','9999']];
export function priceRows(payload,symbol,asOf){
 const x=payload.chart.result[0];assert.equal(x.meta.symbol,symbol);assert.equal(x.meta.dataGranularity,'1d');
 const raw=x.indicators.quote[0].close,adjusted=x.indicators.adjclose?.[0]?.adjclose||raw;
 const result=x.timestamp.flatMap((t,i)=>{const date=new Date(t*1000).toISOString().slice(0,10);return date<=asOf&&raw[i]!==null&&adjusted[i]!==null?[{date,value:raw[i],adjusted:adjusted[i]}]:[];}).sort((a,b)=>a.date.localeCompare(b.date));
 assert.equal(new Set(result.map(r=>r.date)).size,result.length);for(const r of result)assert.ok(r.value>0&&r.adjusted>0);return result;
}
function known(rows,cutoff){const r=rows.filter(r=>r.cutoff<=cutoff).at(-1);return r&&day(cutoff)-day(r.cutoff)<=62?r:null;}
export async function reconstruct(){
 const v5=await read('data/bottoming.json'),macro=(await read('work/research-v2/features.json')).rows,scores=(await read('work/research-v3/features.json')).rows;
 for(const receipt of v5.sources)assert.equal(await hash(receipt.file),receipt.sha256);
 assert.equal(await hash('work/research-v2/features.json'),v5.macroInputSha256);assert.equal(await hash('work/research-v3/features.json'),v5.scoreInputSha256);
 const index=priceRows(await read('work/research-v5/sp500-daily.json'),'^GSPC',v5.asOf),spy=priceRows(await read('work/research-v5/spy-daily.json'),'SPY',v5.asOf);
 const now=new Date(`${v5.asOf}T23:59:59.999Z`),iw=weeklyRsi(completedWeeks(index,now)),sw=completedWeeks(spy.map(r=>({date:r.date,value:r.adjusted})),now);
 const weeklyIndex=new Map(iw.map((r,i)=>[r.week,i])),weeklySpy=new Map(sw.map((r,i)=>[r.week,i])),lookup=new Map(spy.map((r,i)=>[r.date,i]));
 const calendar=v5.archiveWeeks.map((base,i)=>{
  const j=weeklyIndex.get(base.week),k=weeklySpy.get(base.week),m=known(macro,base.cutoff),s=known(scores,base.cutoff);
  close(iw[j].rsi,base.rsi);const classification=classifyBottoming(base);for(const key of ['level','lower','upper','complete'])assert.equal(classification[key],base[key]);
  const prior=v5.archiveWeeks[i-1],old=v5.archiveWeeks[i-4];
  const vol=sd(sw.slice(k-52,k+1).slice(1).map((r,q)=>r.value/sw[k-52+q].value-1))*Math.sqrt(52);
  const entryIndex=lookup.get(base.executionDate),endDate=v5.archiveWeeks[i+1]?.executionDate??null,endIndex=endDate?lookup.get(endDate):null;
  const r={...base,i,gap10:iw[j].value/mean(iw.slice(j-9,j+1).map(r=>r.value))-1,gap40:iw[j].value/mean(iw.slice(j-39,j+1).map(r=>r.value))-1,
   pastVol:vol,macroCutoff:m?.cutoff??null,scoreCutoff:s?.cutoff??null,growth:m?.growth??null,inflation:m?.inflation??null,
   priceZ:s?.assets.SPY.price.z??null,valueZ:s?.assets.SPY.value.z??null,cashYield:m?.cashYield??null,
   setup:!!(prior&&prior.complete&&base.complete&&day(base.week)-day(prior.week)===7&&prior.level<2&&base.level>=2),
   stressImproving:!!(old&&day(base.week)-day(old.week)===28&&[base.vix,base.hy,old.vix,old.hy].every(finite)&&base.vix<old.vix&&base.hy<old.hy),
   riskCap:finite(vol)&&vol>0?Math.min(1,.1/vol):0,entryIndex,endDate,endIndex};
  if(endDate){r.days=day(endDate)-day(base.executionDate);r.marketReturn=spy[endIndex].adjusted/spy[entryIndex].adjusted-1;assert.ok(finite(r.cashYield));r.cashReturn=(1+r.cashYield/100)**(r.days/365)-1;}
  else Object.assign(r,{days:null,marketReturn:null,cashReturn:null});return r;
 });
 return {calendar,spy,v5};
}
export function condition(rule,r){
 const price=r.gap10>0,recovery=r.stressImproving&&price;
 return rule==='immediate'?true:rule==='stress'?r.stressImproving:rule==='price'?price:rule==='recovery'?recovery:
  rule==='price-z'?recovery&&finite(r.priceZ)&&r.priceZ<=0:rule==='macro'?recovery&&finite(r.growth)&&finite(r.inflation)&&r.growth>0&&r.inflation<0:
  rule==='value'?recovery&&finite(r.valueZ)&&r.valueZ>=0:false;
}
export function confirmations(cal,start,rule){
 const records=[];let pending=null;
 for(const r of cal.slice(start)){
  if(pending&&r.i-pending.setupIndex>26){Object.assign(pending,{status:'expired',resolvedWeek:r.week});pending=null;}
  if(r.setup){const record={setupWeek:r.week,setupIndex:r.i,status:'pending',deadlineWeek:new Date((day(r.week)+26*7)*86400000).toISOString().slice(0,10)};
   if(pending)Object.assign(record,{status:'merged',mergedInto:pending.setupWeek});else pending=record;records.push(record);}
  if(pending&&condition(rule,r)){Object.assign(pending,{status:'confirmed',confirmationWeek:r.week,confirmationIndex:r.i,executionDate:r.executionDate,delayWeeks:r.i-pending.setupIndex});pending=null;}
 }
 return records;
}
export function transact(before,target,c){const notional=target>=before?(target-before)/(1+c*target):(before-target)/(1-c*target);return {notional,cost:c*notional};}
export function metrics(rows,cal,marks){
 if(!rows.length)return {available:false};const returns=rows.map(r=>r.return),ex=rows.map(r=>r.return-cal[r.i].cashReturn),years=rows.reduce((s,r)=>s+cal[r.i].days,0)/365.25;
 let wealth=1,stress=1,turnover=0;const daily=new Map();
 for(const r of rows){for(const [date,factor] of marks.get(r.i))daily.set(date,wealth*factor);wealth*=1+r.return;stress*=1+r.stressReturn;turnover+=r.turnover+r.terminalTurnover;}
 let peak=1,drawdown=0;for(const value of daily.values()){peak=Math.max(peak,value);drawdown=Math.min(drawdown,value/peak-1);}
 const spread=sd(ex);
 return {available:true,n:rows.length,first:cal[rows[0].i].executionDate,last:cal[rows.at(-1).i].endDate,cagr:wealth**(1/years)-1,
  volatility:rows.length>1?sd(returns)*Math.sqrt(52):null,sharpe:spread>1e-12?mean(ex)/spread*Math.sqrt(52):null,
  annualMeanExcess:mean(ex)*52,maxDrawdown:drawdown,finalWealth:wealth,cagrAt25bps:stress**(1/years)-1,
  riskyExposure:rows.reduce((s,r)=>s+r.weight*cal[r.i].days,0)/(years*365.25),turnoverAnnual:turnover/years};
}
export function policy(cal,spy,start,key,records){
 const [kind,rule]=key.split(':'),signals=new Set(records.filter(r=>r.status==='confirmed').map(r=>r.confirmationIndex));
 const rows=[],marks=new Map(),executions=[];let before=0,until=-1;
 for(let i=start;i<cal.length-1;i++){
  const r=cal[i];if(signals.has(i)){const ignored=i<until;executions.push({week:r.week,executionDate:r.executionDate,status:ignored?'ignored; existing event position':'entered',untilIndex:ignored?until:i+52});if(!ignored)until=i+52;}
  const active=i<until,core=r.gap40>0,on=kind==='market'||kind==='trend'&&core||kind==='event'&&active||kind==='overlay'&&(active||core),weight=on?r.riskCap:0;
  const t=transact(before,weight,.001),st=transact(before,weight,.0025),growth=weight*(1+r.marketReturn)+(1-weight)*(1+r.cashReturn),drift=weight*(1+r.marketReturn)/growth;
  const terminal=i===cal.length-2?.001*drift:0,stressTerminal=i===cal.length-2?.0025*drift:0;
  const row={i,weight,return:(1-t.cost)*growth*(1-terminal)-1,stressReturn:(1-st.cost)*growth*(1-stressTerminal)-1,
   turnover:t.notional,cost:t.cost,terminalCost:terminal,terminalTurnover:terminal?drift:0,eventActive:active,coreOn:core};rows.push(row);before=drift;
  const daily=spy.slice(r.entryIndex,r.endIndex+1).map(p=>{let factor=(1-t.cost)*(weight*p.adjusted/spy[r.entryIndex].adjusted+(1-weight)*(1+r.cashYield/100)**((day(p.date)-day(r.executionDate))/365));if(p.date===r.endDate)factor*=1-terminal;return [p.date,factor];});marks.set(i,daily);
 }
 const result={kind,rule:rule??null,rows,executions,...metrics(rows,cal,marks),folds:{},omitBlocks:{}};
 for(const [label,startYear,endYear] of folds){
  const belongs=r=>cal[r.i].executionDate.slice(0,4)>=startYear&&cal[r.i].executionDate.slice(0,4)<endYear;
  const subset=rows.filter(belongs),rest=rows.filter(r=>!belongs(r));if(subset.length)result.folds[label]=metrics(subset,cal,marks);if(subset.length&&rest.length)result.omitBlocks[label]=metrics(rest,cal,marks);
 }
 return result;
}
export function gates(a,b){const risk=a.volatility<=1.1*b.volatility+1e-12;return {higherReturn:a.cagr>b.cagr&&risk&&a.maxDrawdown>=b.maxDrawdown-1e-12,
 defensiveTradeoff:a.cagr>=b.cagr-.005&&risk&&Math.abs(a.maxDrawdown)<=.8*Math.abs(b.maxDrawdown)&&finite(a.sharpe)&&finite(b.sharpe)&&a.sharpe>b.sharpe};}
export function quantile(a,q){const s=[...a].sort((a,b)=>a-b),i=(s.length-1)*q,j=Math.floor(i);return s[j]+(s[Math.min(j+1,s.length-1)]-s[j])*(i-j);}
export function bootstrap(a,b,cash,starts){
 const n=a.length;function sharpe(values,rf){const x=values.map((v,i)=>v-rf[i]);return mean(x)/sd(x)*Math.sqrt(52);}
 const observed=sharpe(a,cash)-sharpe(b,cash),draws=[];
 for(const row of starts){let sumA=0,sumB=0,sumA2=0,sumB2=0,count=0;
  for(const start of row){for(let k=0;k<52&&count<n;k++,count++){const i=(start+k)%n,aa=a[i]-cash[i],bb=b[i]-cash[i];sumA+=aa;sumB+=bb;sumA2+=aa*aa;sumB2+=bb*bb;}}
  assert.equal(count,n);const ma=sumA/n,mb=sumB/n,sa=Math.sqrt((sumA2-n*ma*ma)/(n-1)),sb=Math.sqrt((sumB2-n*mb*mb)/(n-1));draws.push((ma/sa-mb/sb)*Math.sqrt(52));
 }
 return {difference:observed,lower95:quantile(draws,.025),upper95:quantile(draws,.975),p:(1+draws.filter(v=>Math.abs(v-observed)>=Math.abs(observed)-1e-12).length)/(draws.length+1),blockWeeks:52,replications:draws.length,n};
}
export async function verify(){
 const data=await read('work/research-v6/research-candidate.json'),{calendar:cal,spy}=await reconstruct();
 for(const [file,key] of [['scripts/research/v6/protocol.md','protocolSha256'],['data/bottoming.json','bottomingInputSha256'],['work/research-v2/features.json','macroInputSha256'],['work/research-v3/features.json','scoreInputSha256'],['work/research-v5/source-manifest.json','sourceManifestSha256']])assert.equal(data[key],await hash(file));
 assert.equal(data.confirmedEdge,false);assert.equal(data.calendar.length,cal.length);
 for(let i=0;i<cal.length;i++){const expected={...cal[i]};for(const k of ['entryIndex','endIndex','cashYield','context','fullEligible','archiveEligible','newSignal'])delete expected[k];same(expected,data.calendar[i]);}
 const audit={calendarChecks:cal.length,signalChecks:0,policyChecks:0,summaryChecks:0,procedureChecks:0,bootstrapChecks:0};
 const definitions={main:[0,['immediate','stress','recovery','price']],price:[cal.findIndex(r=>finite(r.priceZ)),['immediate','stress','recovery','price','price-z']],
  context:[cal.findIndex(r=>[r.priceZ,r.valueZ,r.growth,r.inflation].every(finite)),['immediate','stress','recovery','price','price-z','macro','value']]};
 const independent={};
 for(const [cohort,[start,rules]] of Object.entries(definitions)){
  const study=data.cohorts[cohort];assert.equal(study.startIndex,start);assert.deepEqual(study.rules,rules);assert.equal(study.holdingIntervals,cal.length-1-start);
  const signals={};for(const rule of rules){signals[rule]=confirmations(cal,start,rule);same(signals[rule],study.signals[rule]);audit.signalChecks+=signals[rule].length;}
  const keys=['market','trend','cash',...rules.flatMap(r=>[`event:${r}`,`overlay:${r}`])];assert.equal(Object.keys(study.strategies).length,keys.length);independent[cohort]={};
  for(const key of keys){const expected=policy(cal,spy,start,key,signals[key.split(':')[1]]||[]);same(expected,study.strategies[key]);independent[cohort][key]=expected;audit.policyChecks+=expected.rows.length;audit.procedureChecks++;audit.summaryChecks+=1+Object.keys(expected.folds).length+Object.keys(expected.omitBlocks).length;}
  for(const key of keys.filter(k=>k.includes(':'))){const a=study.strategies[key],kind=key.split(':')[0],expected={};for(const ref of [`${kind}:immediate`,'trend','market'])expected[ref]=gates(a,study.strategies[ref]);same(expected,a.gates);assert.equal(a.economicCandidate,Object.values(expected).every(g=>g.higherReturn));assert.equal(a.defensiveCandidate,Object.values(expected).every(g=>g.defensiveTradeoff));assert.equal(a.confirmedEdge,false);}
 }
 assert.equal(audit.procedureChecks,41);const starts=await read('work/research-v6/bootstrap-starts.json'),s=independent.main,cash=cal.slice(0,-1).map(r=>r.cashReturn);
 assert.equal(starts.length,2500);for(const row of starts){assert.equal(row.length,Math.ceil(cash.length/52));for(const i of row)assert.ok(Number.isInteger(i)&&i>=0&&i<cash.length);}
 const expectedTests=[];for(const rule of ['stress','recovery'])for(const reference of ['overlay:immediate','trend','market']){
  const model=`overlay:${rule}`,a=s[model],b=s[reference];const t={model,reference,...bootstrap(a.rows.map(r=>r.return),b.rows.map(r=>r.return),cash,starts),foldGains:{}};
  for(const label of Object.keys(a.folds))t.foldGains[label]=a.folds[label].annualMeanExcess-b.folds[label].annualMeanExcess;expectedTests.push(t);audit.bootstrapChecks++;
 }
 let last=0;for(const [rank,c] of [...expectedTests].sort((a,b)=>a.p-b.p).entries()){last=Math.min(1,Math.max(last,(6-rank)*c.p));c.holmP=last;}
 same(expectedTests,data.primaryComparisons);
 for(const rule of ['stress','recovery']){const a=data.cohorts.main.strategies[`overlay:${rule}`],tests=expectedTests.filter(t=>t.model===`overlay:${rule}`);assert.equal(a.strongerRetrospectiveSupport,!!((a.economicCandidate||a.defensiveCandidate)&&tests.every(t=>t.lower95>0&&t.holmP<.05)&&Object.values(tests[0].foldGains).every(v=>v>0)));}
 await verifyMemory(data,cal,spy,audit);
 data.audit={status:'Independent reconstruction passed',...audit,protocolSha256:data.protocolSha256};
 const packed=packPolicies(data);for(const cohort of Object.keys(data.cohorts))for(const key of Object.keys(data.cohorts[cohort].strategies))assert.deepEqual(policyRows(packed.cohorts[cohort].strategies[key],packed),data.cohorts[cohort].strategies[key].rows);
 const target=new URL('data/recovery-research.json',root),temporary=new URL('data/recovery-research.json.tmp',root);await writeFile(temporary,JSON.stringify(packed));await rename(temporary,target);console.log(JSON.stringify(data.audit));return data;
}
export async function verifyMemory(data,cal,spy,audit){
 assert.equal(data.memory.protocolSha256,await hash('scripts/research/v6/memory-protocol.md'));
 assert.equal(data.initialCandidateSha256,await hash('work/research-v6/initial-candidate.json'));
 const initial=await read('work/research-v6/initial-candidate.json');for(const key of Object.keys(initial))assert.deepEqual(initial[key],data[key]);
 const weekly=completedWeeks(spy.map(r=>({date:r.date,value:r.adjusted})),new Date(`${data.asOf}T23:59:59.999Z`)),lookup=new Map(weekly.map((r,i)=>[r.week,i]));
 const states=cal.map((r,i)=>{const k=lookup.get(r.week),returns=weekly.slice(k-13,k+1).slice(1).map((p,j)=>p.value/weekly[k-13+j].value-1);return {i,recentStress:cal.slice(Math.max(0,i-26),i+1).some(r=>r.complete&&r.level>=2),shortVol:sd(returns)*Math.sqrt(52)};});
 same(states,data.memory.calendar);audit.memoryStateChecks=states.length;const independent={};
 for(const risk of ['slow','responsive']){
  const clock=cal.map((r,i)=>({...r,...states[i],riskCap:risk==='slow'?r.riskCap:Math.min(1,.1/Math.max(r.pastVol,states[i].shortVol))}));
  const strategies=data.memory.riskEstimates[risk].strategies;independent[risk]={};
  for(const key of ['market','trend','fast','memory-price','memory-recovery']){
   const alt=clock.map(r=>{let on=r.gap40>0;if(key==='fast')on ||= r.gap10>0;if(key.startsWith('memory-'))on ||= r.recentStress&&r.gap10>0&&(key==='memory-price'||r.stressImproving);return {...r,gap40:on?1:-1};});
   const expected=policy(alt,spy,0,key==='market'?'market':'trend',[]);expected.kind=key;expected.rows.forEach(r=>r.coreOn=cal[r.i].gap40>0);same(expected,strategies[key]);independent[risk][key]=expected;
   audit.procedureChecks++;audit.policyChecks+=expected.rows.length;audit.summaryChecks+=1+Object.keys(expected.folds).length+Object.keys(expected.omitBlocks).length;
  }
  for(const key of ['memory-price','memory-recovery']){const a=strategies[key],g=Object.fromEntries(['market','trend','fast'].map(ref=>[ref,gates(a,strategies[ref])]));same(g,a.gates);assert.equal(a.economicCandidate,Object.values(g).every(x=>x.higherReturn));assert.equal(a.defensiveCandidate,Object.values(g).every(x=>x.defensiveTradeoff));assert.equal(a.confirmedEdge,false);}
 }
 const starts=await read('work/research-v6/bootstrap-starts.json'),cash=cal.slice(0,-1).map(r=>r.cashReturn),tests=[];
 for(const risk of ['slow','responsive'])for(const reference of ['market','trend','fast','memory-price']){
  const a=independent[risk]['memory-recovery'],b=independent[risk][reference];const t={risk,model:'memory-recovery',reference,...bootstrap(a.rows.map(r=>r.return),b.rows.map(r=>r.return),cash,starts),foldGains:{}};
  for(const label of Object.keys(a.folds))t.foldGains[label]=a.folds[label].annualMeanExcess-b.folds[label].annualMeanExcess;tests.push(t);audit.bootstrapChecks++;
 }
 let last=0;for(const [rank,c] of [...tests].sort((a,b)=>a.p-b.p).entries()){last=Math.min(1,Math.max(last,(8-rank)*c.p));c.holmP=last;}same(tests,data.memory.primaryComparisons);
 for(const risk of ['slow','responsive']){const a=data.memory.riskEstimates[risk].strategies['memory-recovery'];assert.equal(a.strongerRetrospectiveSupport,!!((a.economicCandidate||a.defensiveCandidate)&&tests.filter(t=>t.risk===risk).every(t=>t.lower95>0&&t.holmP<.05&&Object.values(t.foldGains).every(v=>v>0))));}
 assert.equal(data.totalProcedureCount,51);assert.equal(audit.procedureChecks,51);
}
if(process.argv[1]&&new URL(process.argv[1],'file://').href===import.meta.url)await verify();
