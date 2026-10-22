export const BOTTOMING_VERSION='bottoming-0-3-1';
export const BOTTOMING_RULES=Object.freeze([
 Object.freeze({level:1,label:'Bull Reset',rsi:40,vix:25,hy:4.5,required:2}),
 Object.freeze({level:2,label:'Cyclical Bottom',rsi:33,vix:30,hy:6,required:2}),
 Object.freeze({level:3,label:'Systemic Bottom',rsi:30,vix:40,hy:8,required:3}),
]);
const finite=Number.isFinite;
export function classifyBottoming({rsi,vix,hy}={}){
 const inputs={rsi:finite(rsi)&&rsi>=0&&rsi<=100?rsi:null,
  vix:finite(vix)&&vix>0?vix:null,hy:finite(hy)&&hy>=0?hy:null};
 const levels=BOTTOMING_RULES.map(rule=>{
  const conditions={rsi:inputs.rsi===null?null:inputs.rsi<=rule.rsi,
   vix:inputs.vix===null?null:inputs.vix>=rule.vix,hy:inputs.hy===null?null:inputs.hy>=rule.hy};
  const matches=Object.values(conditions).filter(v=>v===true).length,missing=Object.values(conditions).filter(v=>v===null).length;
  return {...rule,conditions,matches,missing,confirmed:matches>=rule.required,possible:matches+missing>=rule.required};
 });
 const lower=Math.max(0,...levels.filter(r=>r.confirmed).map(r=>r.level));
 const upper=Math.max(0,...levels.filter(r=>r.possible).map(r=>r.level));
 const level=lower===upper?lower:null,complete=Object.values(inputs).every(finite);
 return {level,lower,upper,complete,inputs,levels,label:level===null?'Level uncertain':level===0?'No signal':BOTTOMING_RULES[level-1].label};
}
export function friday(date){
 const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+(5-d.getUTCDay()+7)%7);return d.toISOString().slice(0,10);
}
export function completedWeeks(points,now=new Date()){
 const byWeek=new Map(),seen=new Set();
 for(const p of [...points].sort((a,b)=>a.date.localeCompare(b.date))){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!finite(p.value)||p.value<=0)throw new Error('Invalid index close');
  if(seen.has(p.date))throw new Error('Duplicate index date');seen.add(p.date);
  const week=friday(p.date);
  if(Date.parse(`${week}T23:59:59.999Z`)>=now.getTime())continue;
  byWeek.set(week,{week,date:p.date,value:p.value});
 }
 return [...byWeek.values()];
}
export function weeklyRsi(weeks,period=14){
 if(!Number.isInteger(period)||period<1)throw new Error('Invalid RSI period');
 let previous=null,gains=[],losses=[],gain=null,loss=null;
 return weeks.map(row=>{
  if(previous&&Date.parse(row.week)-Date.parse(previous.week)!==7*86400000){gains=[];losses=[];gain=loss=null;previous=null;}
  if(previous){
   const delta=row.value-previous.value,up=Math.max(0,delta),down=Math.max(0,-delta);
   if(gain===null){gains.push(up);losses.push(down);
    if(gains.length===period){gain=gains.reduce((s,v)=>s+v,0)/period;loss=losses.reduce((s,v)=>s+v,0)/period;}
   }else{gain=(gain*(period-1)+up)/period;loss=(loss*(period-1)+down)/period;}
  }
  const rsi=gain===null?null:loss===0?(gain===0?50:100):100-100/(1+gain/loss);
  previous=row;return {...row,rsi};
 });
}
export function signalIncrease(previous,current){
 return !!(previous?.complete&&current?.complete&&current.level>previous.level&&current.level>0);
}
function matchingObservation(observations,date){
 const p=observations?.find(p=>p.date===date&&finite(Number(p.value))&&p.value!=='.'&&p.value!==null&&String(p.value).trim()!=='');
 return p?Number(p.value):null;
}
export function weeklyBottomingSnapshot({prices,vix=[],hy=[],now=new Date()}){
 const weeks=weeklyRsi(completedWeeks(prices,now));
 const row=weeks.at(-1);if(!row)throw new Error('No completed index week');
 const make=r=>classifyBottoming({rsi:r.rsi,vix:matchingObservation(vix,r.date),hy:matchingObservation(hy,r.date)});
 const classification=make(row),previous=weeks.at(-2)?make(weeks.at(-2)):null;
 const age=(now-Date.parse(`${row.week}T23:59:59Z`))/86400000;
 if(age>14)throw new Error('Index history is stale');
 return {methodVersion:BOTTOMING_VERSION,fetchedAt:now.toISOString(),week:row.week,priceDate:row.date,
  ...classification,newSignal:signalIncrease(previous,classification),previousLevel:previous?.level??null,
  readings:{rsi:{value:row.rsi,date:row.date,method:'S&P 500 price-index Wilder RSI(14), completed weeks'},
   vix:{value:classification.inputs.vix,date:classification.inputs.vix===null?null:row.date,source:'VIXCLS'},
   hy:{value:classification.inputs.hy,date:classification.inputs.hy===null?null:row.date,source:'BAMLH0A0HYM2'}},
  missing:Object.entries(classification.inputs).filter(([,v])=>v===null).map(([k])=>k),
  assumption:'RSI period 14 assumed; supplied screenshots specify weekly RSI but do not show its period.'};
}
