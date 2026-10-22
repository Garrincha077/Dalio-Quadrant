// Lossless column-oriented row packing keeps large research artifacts practical.
export const POLICY_COLUMNS=Object.freeze(['i','weight','return','stressReturn','turnover','cost','terminalCost','terminalTurnover','eventActive','coreOn']);
export function packPolicies(data){
 const copy=structuredClone(data);copy.policyColumns=[...POLICY_COLUMNS];
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.strategies){for(const s of Object.values(node.strategies))s.rows=s.rows.map(r=>POLICY_COLUMNS.map(k=>r[k]));}
  for(const [k,v] of Object.entries(node))if(k!=='strategies')visit(v);};visit(copy);return copy;
}
export function policyRows(strategy,data){
 if(!Array.isArray(strategy?.rows)||!Array.isArray(data?.policyColumns)||data.policyColumns.join('|')!==POLICY_COLUMNS.join('|'))throw Error('Invalid policy schema');
 return strategy.rows.map(row=>{if(!Array.isArray(row)||row.length!==POLICY_COLUMNS.length)throw Error('Invalid policy row');return Object.fromEntries(POLICY_COLUMNS.map((k,i)=>[k,row[i]]));});
}
export function policyWealth(strategy,data){let value=1;return policyRows(strategy,data).map(r=>({i:r.i,value:value*=1+r.return}));}
