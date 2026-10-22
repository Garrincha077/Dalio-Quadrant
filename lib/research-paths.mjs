// Lossless column-oriented row packing keeps large research artifacts practical.
export const POLICY_COLUMNS=Object.freeze(['i','weight','return','stressReturn','turnover','cost','terminalCost','terminalTurnover','eventActive','coreOn']);
const RISK_COLUMNS=POLICY_COLUMNS.filter(k=>!['cost','eventActive','coreOn'].includes(k));
export function packPolicies(data,{risk=false}={}){
 const copy=structuredClone(data),columns=risk?RISK_COLUMNS:POLICY_COLUMNS;copy.policyColumns=[...columns];
 if(risk){copy.policyTradeCost=.001;copy.policyStateSource='/data/recovery-research.json#calendar';}
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.strategies){for(const s of Object.values(node.strategies))s.rows=s.rows.map(r=>columns.map(k=>r[k]));}
  for(const [k,v] of Object.entries(node))if(k!=='strategies')visit(v);};visit(copy);return copy;
}
export function policyRows(strategy,data,calendar=null){
 const columns=data?.policyColumns,compact=Array.isArray(columns)&&columns.join('|')===RISK_COLUMNS.join('|')&&data.policyTradeCost===.001;
 if(!Array.isArray(strategy?.rows)||!Array.isArray(columns)||(!compact&&columns.join('|')!==POLICY_COLUMNS.join('|')))throw Error('Invalid policy schema');
 return strategy.rows.map(row=>{
  if(!Array.isArray(row)||row.length!==columns.length)throw Error('Invalid policy row');
  const r=Object.fromEntries(columns.map((k,i)=>[k,row[i]]));
  if(compact){r.cost=r.turnover*data.policyTradeCost;r.eventActive=false;if(calendar)r.coreOn=calendar[r.i].gap40>0;}
  return r;
 });
}
export function policyWealth(strategy,data){let value=1;return policyRows(strategy,data).map(r=>({i:r.i,value:value*=1+r.return}));}
