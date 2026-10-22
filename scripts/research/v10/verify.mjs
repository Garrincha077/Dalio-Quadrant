import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {root,read,hash,same,reconstruct,priceRows,finite,mean,sd,quantile,day} from '../v6/verify.mjs';
export const columns=['priceZ','valueZ','priceZ20','valueZ20','shortZ','return13','return52','vol52','gap10','gap40'];
export const zbin=z=>!finite(z)?'missing':z< -1?'<-1':z<0?'-1 to 0':z<1?'0 to 1':'>=1';
export function shortZ(closes,j){if(j<252)return null;const past=closes.slice(j-252,j).map(Math.log),s=sd(past);return s>1e-12?(Math.log(closes[j])-mean(past))/s:null;}
const quadrant=(a,b)=>![a,b].every(finite)?'missing':`G${a>=0?'+':'-'}/I${b>=0?'+':'-'}`;
const direction=(a,b)=>![a,b].every(finite)?'missing':`G${a>0?'+':a<0?'-':'0'}/I${b>0?'+':b<0?'-':'0'}`;
const known=(rows,cutoff)=>{const r=rows.filter(r=>r.cutoff<=cutoff).at(-1);return r&&day(cutoff)-day(r.cutoff)<=62?r:null;};
export function calendar(cal,macro,scores){
 const bymonth=new Map(macro.map(r=>[r.tradeDate.slice(0,7),r])),first=new Map();let laststress=null,cluster=-1,lastl3=null,l3cluster=null;
 return cal.map((r,i)=>{
  const m=known(macro,r.cutoff),s=known(scores,r.cutoff),month=m?new Date(Date.UTC(+m.tradeDate.slice(0,4),+m.tradeDate.slice(5,7)-4,1)).toISOString().slice(0,7):null,p=bymonth.get(month),activity=m?.activity??null,inf=m?.inflationGap??null,dg=finite(activity)&&finite(p?.activity)?activity-p.activity:null,di=finite(inf)&&finite(p?.inflationGap)?inf-p.inflationGap:null;
  if(r.complete&&r.level>0){if(laststress===null||i-laststress>26)cluster++;laststress=i;if(r.level===3&&!first.has(cluster)){first.set(cluster,i);lastl3=i;l3cluster=cluster;}}
  const since=lastl3===null?null:i-lastl3,memory=since===null||since>156?'none':since<=4?'0–4':since<=13?'5–13':since<=26?'14–26':since<=52?'27–52':since<=104?'53–104':'105–156',old=cal[i-4],dv=old&&r.vix&&old.vix?r.vix/old.vix-1:null,dh=old&&finite(r.hy)&&finite(old.hy)?r.hy-old.hy:null;
  return {i,week:r.week,executionDate:r.executionDate,cutoff:r.cutoff,complete:r.complete,level:r.complete?r.level:null,macroCutoff:m?.cutoff??null,scoreCutoff:s?.cutoff??null,activity,inflationGap:inf,growthImpulse:dg,inflationImpulse:di,growthMomentum:m?.growth??null,inflationMomentum:m?.inflation??null,static:quadrant(activity,inf),impulse:direction(dg,di),dashboard:direction(m?.growth,m?.inflation),cluster:laststress!==null&&i-laststress<=26?cluster:null,l3Cluster:memory!=='none'?l3cluster:null,firstL3:i===lastl3,weeksSinceL3:memory!=='none'?since:null,memory,rsi:r.rsi,vix:r.vix,hy:r.hy,vixChange4:dv,hyChange4:dh,recovery:finite(dv)&&finite(dh)?dv<0&&dh<0?'improving':'not improving':'missing'};
 });
}
export function event(prices,lookup,cal,i,h){
 if(i+h>=cal.length||!cal[i].complete)return null;const a=lookup.get(cal[i].executionDate),b=lookup.get(cal[i+h].executionDate);if(a===undefined||b===undefined)return null;
 const ratio=prices[b].adjusted/prices[a].adjusted,net=ratio*.999/1.001-1,days=day(cal[i+h].executionDate)-day(cal[i].executionDate),cash=cal.slice(i,i+h).reduce((v,r)=>v*(1+r.cashReturn),1)-1,annual=(1+net)**(365.25/days)-1;
 return [net,annual,cash,annual-((1+cash)**(365.25/days)-1),Math.min(...prices.slice(a,b+1).map(r=>r.adjusted))/prices[a].adjusted-1,ratio*.9975/1.0025-1];
}
export function summary(ix,events,cal,h,threshold){
 if(!ix.length)return null;const rows=ix.map(i=>events[i]),spaced=[];let last=-1e9;for(const i of ix)if(i-last>=h){spaced.push(i);last=i;}
 const a=spaced.map(i=>events[i]),clusters=new Set(ix.map(i=>cal[i].cluster).filter(v=>v!==null)),l3=new Set(ix.filter(i=>cal[i].level===3).map(i=>cal[i].l3Cluster).filter(v=>v!==null));
 return [ix.length,spaced.length,clusters.size,l3.size,new Set(ix.map(i=>Math.floor(i/h))).size,mean(rows.map(r=>r[1])),quantile(rows.map(r=>r[1]),.5),mean(rows.map(r=>r[0])),quantile(rows.map(r=>r[0]),.5),mean(rows.map(r=>r[0]>0?1:0)),mean(rows.map(r=>r[3])),Math.min(...rows.map(r=>r[4])),quantile(rows.map(r=>r[1]),.1),mean(a.map(r=>r[1])),quantile(a.map(r=>r[1]),.5),Math.min(...a.map(r=>r[4])),mean(rows.map(r=>r[1]>=threshold?1:0))];
}
function comparison(events,cal,starts){
 const a=events.map(e=>e?.[1]??null),l3=cal.flatMap((r,i)=>r.level===3&&finite(a[i])?[i]:[]),clusters=[...new Set(l3.map(i=>cal[i].l3Cluster))].sort((a,b)=>a-b),n=cal.length,out=[];
 for(let ref=0;ref<3;ref++){
  const base=cal.flatMap((r,i)=>r.level===ref&&finite(a[i])?[i]:[]),diff=mean(l3.map(i=>a[i]))-mean(base.map(i=>a[i])),draws=[];
  for(const row of starts){let na=0,nb=0,sa=0,sb=0,k=0;for(const start of row){for(let j=0;j<156&&k<n;j++,k++){const i=(start+j)%n;if(!finite(a[i]))continue;if(cal[i].level===3){sa+=a[i];na++;}else if(cal[i].level===ref){sb+=a[i];nb++;}}}if(na&&nb)draws.push(sa/na-sb/nb);}
  const leave=clusters.map(c=>{const keep=l3.filter(i=>cal[i].l3Cluster!==c),m=keep.length?mean(keep.map(i=>a[i])):null;return {omittedCluster:c,remainingL3N:keep.length,remainingL3MeanAnnual:m,difference:m===null?null:m-mean(base.map(i=>a[i]))};});
  out.push({referenceLevel:ref,l3N:l3.length,referenceN:base.length,l3Clusters:clusters.length,difference:diff,lower95:quantile(draws,.025),upper95:quantile(draws,.975),validDraws:draws.length,p:null,holmP:null,inference:'Withheld: fewer than five L3 crisis clusters',leaveOneL3CrisisOut:leave});
 }
 return out;
}
export async function verify(){
 const d=await read('work/research-v10/research-candidate.json'),macro=(await read('work/research-v2/features.json')).rows,scores=(await read('work/research-v3/features.json')).rows,{calendar:base}=await reconstruct(),cal=calendar(base,macro,scores),draws=await read('work/research-v10/bootstrap-starts.json');
 assert.equal(d.protocolSha256,await hash('scripts/research/v10/protocol.md'));for(const [path,digest] of Object.entries(d.sourceHashes))assert.equal(await hash(path),digest);same(cal,d.calendar);assert.equal(cal.filter(r=>r.firstL3).length,2);
 const audit={sourceChecks:0,calendarChecks:cal.length,featureChecks:0,eventChecks:0,completeEventChecks:0,summaryChecks:0,antecedentChecks:0,comparisonChecks:0};assert.equal(draws.length,2500);for(const row of draws){assert.equal(row.length,Math.ceil(cal.length/156));for(const i of row)assert.ok(Number.isInteger(i)&&i>=0&&i<cal.length);}
 for(const receipt of d.sources){
  const asset=receipt.symbol;assert.equal(await hash(receipt.file),receipt.sha256);assert.equal(await hash(receipt.monthlyCheck.source),receipt.monthlyCheck.sha256);const prices=priceRows(await read(receipt.file),asset,d.asOf),lookup=new Map(prices.map((r,i)=>[r.date,i]));
  const csv=(await readFile(new URL(receipt.monthlyCheck.source,root),'utf8')).trim().split(/\r?\n/),headers=csv.shift().split(','),time=headers.indexOf('timestamp'),adj=headers.indexOf('adjusted close');
  const months=csv.map(l=>l.split(',')).filter(r=>r[time].slice(0,7)<d.asOf.slice(0,7)).sort((a,b)=>a[time].localeCompare(b[time])),errors=[],outliers=[];
  for(let k=1;k<months.length;k++){const a=months[k-1],b=months[k],ia=lookup.get(a[time]),ib=lookup.get(b[time]);if(ia!==undefined&&ib!==undefined){const difference=prices[ib].adjusted/prices[ia].adjusted-b[adj]/a[adj];errors.push(Math.abs(difference));if(Math.abs(difference)>.002)outliers.push({date:b[time],difference});}}
  const check=receipt.monthlyCheck;same(errors.length,check.n);same(Math.max(...errors),check.maximumReturnDifference);same(quantile(errors,.95),check.p95ReturnDifference);same(outliers,check.outliers);assert.equal(check.status,errors.length>=120&&Math.max(...errors)<=.002&&quantile(errors,.95)<=.0002?'passed':'needs-review');audit.sourceChecks++;
  const weekly=base.map(r=>lookup.has(r.priceDate)?prices[lookup.get(r.priceDate)]:null),features=base.map((r,i)=>{
   const s=known(scores,r.cutoff)?.assets[asset],j=lookup.get(r.priceDate),current=weekly[i],past=weekly.slice(Math.max(0,i-52),i+1),vol=past.length===53&&past.every(Boolean)?sd(past.slice(1).map((p,k)=>p.adjusted/past[k].adjusted-1))*Math.sqrt(52):null;
   const mom=h=>current&&i>=h&&weekly[i-h]?current.adjusted/weekly[i-h].adjusted-1:null,trend=h=>current&&i>=h-1&&weekly.slice(i-h+1,i+1).every(Boolean)?current.value/mean(weekly.slice(i-h+1,i+1).map(p=>p.value))-1:null;
   return [s?.price.z??null,s?.value.z??null,s?.price.z20??null,s?.value.z20??null,j===undefined?null:shortZ(prices.map(p=>p.value),j),mom(13),mom(52),vol,trend(10),trend(40)];
  });same(features,d.assetFeatures[asset]);audit.featureChecks+=features.length*columns.length;
  for(const h of d.horizons){
   const study=d.studies[asset][h],events=cal.map((_,i)=>event(prices,lookup,base,i,h));same(events,study.events);audit.eventChecks+=events.length;audit.completeEventChecks+=events.filter(Boolean).length;
   const valid=events.flatMap((e,i)=>e?[i]:[]),threshold=quantile(valid.map(i=>events[i][1]),.9);same(threshold,study.threshold90);same(summary(valid,events,cal,h,threshold),study.summary);audit.summaryChecks++;
   for(const [family,{fields}] of Object.entries(d.families)){
    const groups=new Map();for(const i of valid){const f=Object.fromEntries(columns.map((k,j)=>[k,features[i][j]])),r={...cal[i],priceBin:zbin(f.priceZ),valueBin:zbin(f.valueZ),shortBin:zbin(f.shortZ)},key=fields.map(k=>String(r[k])).join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
    assert.equal(groups.size,Object.keys(study.cells[family]).length);for(const [key,ix] of groups){same(summary(ix,events,cal,h,threshold),study.cells[family][key]);audit.summaryChecks++;}
   }
   for(const entry of study.antecedents){
    const values=i=>({...Object.fromEntries(columns.map((k,j)=>[k,features[i][j]])),...cal[i]})[entry.feature],ix=valid.filter(i=>finite(values(i)));assert.equal(ix.length,entry.n);if(!ix.length){audit.antecedentChecks++;continue;}
    const cut=quantile(ix.map(i=>events[i][1]),.9),top=ix.filter(i=>events[i][1]>=cut),other=ix.filter(i=>events[i][1]<cut),scale=sd(ix.map(values)),tm=mean(top.map(values)),om=mean(other.map(values));
    const spaced=[];for(const i of top)if(!spaced.length||i-spaced.at(-1)>=h)spaced.push(i);same({feature:entry.feature,n:ix.length,topN:top.length,topSpacedN:spaced.length,topCalendarBlocks:new Set(top.map(i=>Math.floor(i/h))).size,annualThreshold:cut,topMedian:quantile(top.map(values),.5),otherMedian:quantile(other.map(values),.5),standardizedDifference:scale>1e-12?(tm-om)/scale:null,topMean:tm,otherMean:om,first:cal[ix[0]].week},entry);audit.antecedentChecks++;
   }
   const best=[];for(const i of [...valid].sort((a,b)=>events[b][1]-events[a][1])){if(best.every(j=>Math.abs(i-j)>=52))best.push(i);if(best.length===5)break;}assert.deepEqual(best,study.bestEntryExamples);
   if(h===156){same(comparison(events,cal,draws),d.primaryComparisons[asset]);audit.comparisonChecks+=3;}
  }
 }
 assert.equal(d.confirmedEdge,false);d.audit={status:'Independent shock, regime and asset reconstruction passed',...audit};const tmp=new URL('data/shock-asset-research.json.tmp',root);await writeFile(tmp,JSON.stringify(d));await rename(tmp,new URL('data/shock-asset-research.json',root));console.log(JSON.stringify(d.audit));return d;
}
if(process.argv[1]&&new URL(process.argv[1],'file://').href===import.meta.url)await verify();
