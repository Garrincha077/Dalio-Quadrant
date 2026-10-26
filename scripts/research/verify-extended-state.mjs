// Independent arithmetic and decision audit against private normalised prices.
// Usage: node scripts/research/verify-extended-state.mjs REPORT MANIFEST
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [reportPath, manifestPath] = process.argv.slice(2);
if (!reportPath || !manifestPath) throw new Error('Provide report and private price manifest');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const csv = fs.readFileSync(path.resolve(path.dirname(manifestPath), manifest.prices), 'utf8').trim().split(/\r?\n/).map(l => l.split(','));
const names = csv.shift().slice(1), assets = names.slice(0, -1), cash = names.length-1;
const prices = new Map(csv.map(r => [r[0].slice(0,7), r.slice(1).map(Number)]));
const state = JSON.parse(fs.readFileSync(new URL('../../data/state-forward.json', import.meta.url))).points;
const states = new Map(state.map(r => [r.month, r]));
const shift = (m, n) => new Date(Date.UTC(+m.slice(0,4), +m.slice(5,7)-1+n, 1)).toISOString().slice(0,7);
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);
const dir = (v, band) => v > band+1e-9 ? 'up' : v < -band-1e-9 ? 'down' : 'flat';
function signal(m) {
  const ref = shift(m, -2), rows = [-3,-2,-1,0].map(n => states.get(shift(ref,n)));
  if (rows.some(r => !r)) return null;
  return {...rows[3], trend: dir(rows[3].activity-rows[0].activity,.1)+'/'+dir(rows[3].inflation-rows[0].inflation,.2)};
}
function means(s, pool, mode) {
  const global = assets.map((_,j) => pool.reduce((x,r)=>x+r.returns[j],0)/pool.length);
  if (mode === 'unconditional') return global;
  const x = Math.max(0,Math.min(1,(s.activity+.1)/.2)), y = Math.max(0,Math.min(1,(s.inflation-1.8)/.4));
  const q = ['above-above','above-below','below-above','below-below'], mix = [x*y,x*(1-y),(1-x)*y,(1-x)*(1-y)];
  const result = assets.map(()=>0);
  q.forEach((key,k)=>{
    const parent = pool.filter(r=>r.signal.quadrant===key), joint = parent.filter(r=>r.signal.trend===s.trend);
    const a = parent.length/(parent.length+24), b = joint.length/(joint.length+24);
    assets.forEach((_,j)=>{
      const p = a*(parent.length ? parent.reduce((n,r)=>n+r.returns[j],0)/parent.length : 0)+(1-a)*global[j];
      const t = b*(joint.length ? joint.reduce((n,r)=>n+r.returns[j],0)/joint.length : 0)+(1-b)*p;
      result[j] += mix[k]*(mode==='state-only' ? p : t);
    });
  });
  return result;
}
assert.equal(report.returnStudy.basis, 'revised-history-with-two-month-delay');
assert.equal(report.returnStudy.goldAnnualCostBps, 0, 'This verifier uses raw zero-carry source levels');
let checked=0;
for (const mode of ['state-trend','unconditional','state-only']) {
  const sleeves = Array.from({length:12},()=>({asset:cash,value:1/12}));
  const saved = report.returnStudy.monthlyPortfolios[mode];
  report.returnStudy.decisions.forEach((decision,i)=>{
    const m = decision.decisionMonth, s = signal(m);
    const pool = [...prices.keys()].filter(k=>k<m && shift(k,12)<m && prices.has(shift(k,12)))
      .map(k=>({signal:signal(k),returns:assets.map((_,j)=>prices.get(shift(k,12))[j]/prices.get(k)[j]-1)})).filter(r=>r.signal);
    assert.equal(pool.length, decision.trainingLabels);
    let chosen=cash;
    if(s && pool.length>=60) {
      const estimates=means(s,pool,mode), order=assets.map((_,j)=>j).sort((a,b)=>estimates[b]-estimates[a]||assets[a].localeCompare(assets[b]));
      if(estimates[order[0]]>0) chosen=order[0];
    }
    assert.equal(names[chosen],decision.choices[mode]);
    const before=sleeves.reduce((v,r)=>v+r.value,0), sleeve=sleeves[i%12], old=sleeve.asset;
    let fee=0;
    if (old!==chosen) {
      const sell=old===cash ? 0 : .001, buy=chosen===cash ? 0 : .001;
      const newValue=sleeve.value*(1-sell)/(1+buy);
      fee=sleeve.value-newValue;sleeve.value=newValue;sleeve.asset=chosen;
    }
    const today=prices.get(m), next=prices.get(shift(m,1));
    sleeves.forEach(r=>r.value*=next[r.asset]/today[r.asset]);
    const after=sleeves.reduce((v,r)=>v+r.value,0);
    close(saved[i].return,after/before-1);close(saved[i].costFraction,fee/before);
    checked++;
  });
}
console.log(`Independent audit passed: ${checked} monthly decisions, net returns and costs.`);
