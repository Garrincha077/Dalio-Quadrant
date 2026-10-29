// Independent JS checks against actual private price inputs and published outputs.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { rankIC } from "../../../lib/research-evidence.mjs";
const root = new URL("../../../", import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const hash = async (p) => createHash("sha256").update(await readFile(new URL(p, root))).digest("hex");
const data = await read("data/research-v2.json");
const history = await read("data/research-history.json");
const frozen = await read("data/state-forward.json");
const source = await read("work/research-v2/source-manifest.json");
const features = await read("work/research-v2/features.json");
const ledger = await read("data/forecast-ledger.json");
const shifts = (m,n) => new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7))-1+n,1)).toISOString().slice(0,7);
const prices = {};
const close = (a,b,tol=1e-10) => assert.ok(Math.abs(a-b)<=tol, `Numerical mismatch ${a} vs ${b}`);
for (const a of data.assets) {
  const csv = (await readFile(new URL(`work/research-v2/prices/${a}.csv`,root),"utf8")).trim().split(/\r?\n/);
  const columns=csv.shift().split(","),value=columns.indexOf("adjusted close");
  prices[a]=new Map(csv.map((l) => l.split(",")).filter((r) => r[0].slice(0,7)<data.asOf.slice(0,7)).map((r) => [r[0].slice(0,7), Number(r[value])]));
  assert.equal(prices[a].size,csv.filter((l) => l.slice(0,7)<data.asOf.slice(0,7)).length);
}
assert.equal(await hash("scripts/research/v2/protocol.md"),data.protocolSha256);
let forecastChecks=0, strategyChecks=0, frozenChecks=0, staticClassificationChecks=0, maxFrozenDifference=0;
for(const [h,study] of Object.entries(data.horizons)) {
  for(const r of study.forecastRows) {
    for(const [m,pred] of Object.entries(r.predictions)) {
      if(pred.every(Number.isFinite)) assert.ok(r.training[m]>=60);
      const ic=rankIC(pred,r.outcomes);
      if(ic!==null) { close(ic,r.rankIC[m]);forecastChecks++; }
    }
    if(r.outcomes.every(Number.isFinite)) {
      // Independently reconstruct cash carry at each native decision from private features.
      let cashWealth=1;
      const t=features.rows.findIndex((f) => f.tradeDate===r.tradeDate);
      for(let k=0;k<Number(h);k++) {
        const f=features.rows[t+k],next=features.rows[t+k+1];
        const days=(Date.parse(next.tradeDate)-Date.parse(f.tradeDate))/86400000;
        cashWealth*=(1+f.cashYield/100)**(days/365);
      }
      for(const [i,a] of data.assets.entries()) {
        const start=prices[a].get(r.month),end=prices[a].get(shifts(r.month,Number(h)));
        close(end/start-cashWealth,r.outcomes[i]);forecastChecks++;
      }
    }
  }
  for(const [name,s] of Object.entries(study.strategies)) {
    if(!s?.available) continue;
    let prior=[1,0,0,0,0,0],wealth=1,peak=1,dd=0;
    for(const r of s.rows) {
      const returns=[r.cash,...data.assets.map((a) => prices[a].get(r.month)/prices[a].get(shifts(r.month,-1))-1)];
      const cost=r.weights.slice(1).reduce((sum,w,i) => sum+Math.abs(w-prior[i+1])*.001,0);
      const ret=r.weights.reduce((sum,w,i) => sum+w*returns[i],0)-cost;
      close(cost,r.cost);close(ret,r.return);close(r.weights.reduce((s,w) => s+w,0),1);
      close(r.weights.reduce((sum,w,i) => sum+Math.abs(w-prior[i]),0)/2,r.turnover);
      const grown=r.weights.map((w,i) => w*(1+returns[i])),total=grown.reduce((a,b) => a+b,0);
      prior=grown.map((v) => v/total);
      wealth*=1+ret;peak=Math.max(peak,wealth);dd=Math.min(dd,wealth/peak-1);strategyChecks++;
    }
    close(wealth**(12/s.rows.length)-1,s.cagr);close(dd,s.maxDrawdown);
    const mean=(v) => v.reduce((s,x) => s+x,0)/v.length;
    const sd=(v) => Math.sqrt(v.reduce((s,x) => s+(x-mean(v))**2,0)/(v.length-1));
    const returns=s.rows.map((r) => r.return),excess=s.rows.map((r) => r.return-r.cash);
    close(sd(returns)*Math.sqrt(12),s.volatility);
    if(s.sharpe!==null) close(mean(excess)/sd(excess)*Math.sqrt(12),s.sharpe);
  }
  for(const [m,s] of Object.entries(study.models)) {
    const rows=study.forecastRows.filter((r) => r.common && r.predictions[m].every(Number.isFinite));
    assert.equal(rows.length,s.n);
    if(rows.length) close(rows.reduce((s,r) => s+rankIC(r.predictions[m],r.outcomes),0)/rows.length,s.meanRankIC);
  }
}
for(const point of frozen.points) {
  const quadrant=point.activity===0||point.inflation===2 ? "boundary" : `${point.activity>0?"above":"below"}-${point.inflation>2?"above":"below"}`;
  assert.equal(quadrant,point.quadrant);staticClassificationChecks++;
}
for(const point of frozen.points) for(const lag of [0,2]) for(const a of data.assets) for(const [i,h] of [3,12,36].entries()) {
  const value=point.returns[String(lag)][a][i];if(!Number.isFinite(value)) continue;
  const start=prices[a].get(shifts(point.month,lag)),end=prices[a].get(shifts(point.month,lag+h));
  if(start&&end) { maxFrozenDifference=Math.max(maxFrozenDifference,Math.abs(end/start-1-value));frozenChecks++; }
}
const macroSources=[];
for(const id of source.series) {
  const s=await read(`work/research-v2/fred/${id}.json`);
  const valid=s.latest.filter((r) => Number.isFinite(Number.parseFloat(r.value)));
  macroSources.push({id,first:valid[0]?.date,last:valid.at(-1)?.date,n:valid.length,vintageStart:s.vintageStart,
    basis:"FRED/ALFRED",source:`https://fred.stlouisfed.org/series/${id}`,
    sha256:await hash(`work/research-v2/fred/${id}.json`)});
}
const originalHashes={};
for(const path of ["data/research-summary.json","data/state-forward.json","scripts/research/protocol.md","scripts/research/state-forward-protocol.md"])
  originalHashes[path]=await hash(path);
const audit={version:"evidence-audit-2",asOf:data.asOf,status:"Checked within stated scope",
  independentChecks:{forecastChecks,strategyChecks,staticClassificationChecks,frozenPriceComparisons:frozenChecks,maxFrozenReturnDifference:maxFrozenDifference},
  originalHashes,macroSources,priceCoverage:data.priceCoverage,
  claims:[
    {id:"static-history",status:"descriptive",title:"Economic-state history",first:history.points[0].month,last:history.points.at(-1).month,n:history.points.length,
      caveat:"Latest-revised reference periods. CFNAI was first published in March 2001; the fixed 2% inflation anchor is retrospective before 2012."},
    {id:"long-equity",status:"descriptive",title:"Long-run equity outcomes",first:history.equityProxy.first,last:history.equityProxy.last,n:history.equityProxy.n,
      caveat:"Fama/French broad-US-market proxy, not SPY. State-conditioned outcomes start in 1967 and use revised macro data."},
    {id:"combined-model",status:data.status,title:"State + momentum model",first:data.horizons["12"].models.combined.first,last:data.horizons["12"].models.combined.last,n:data.horizons["12"].models.combined.n,
      caveat:"Overlapping starts are not independent tests. Historical protocol was designed after prior research; the advantage is unconfirmed."},
    {id:"state-trend",status:"descriptive",title:"Existing live research preference",caveat:"Frozen revised-data analogues. Its mean and loss frequency are historical estimates, not calibrated future probabilities."},
    {id:"forward-ledger",status:"forward-tracking",title:"Future forecast tracking",n:ledger.forecasts.length,caveat:"Historical reconstructions are not backfilled into the live ledger."}],
  limitations:["This verifies computation and source coverage; it does not establish an economic forecasting edge.",
    "Frozen v1 return differences versus newly downloaded sources are reported as source reconciliation, not silently overwritten.",
    "SPY provider history begins in December 1999 although the fund launched in 1993; earlier verified adjusted prices remain a source gap.",
    "JST annual context ends in 2020; it is not a current market reading."]};
await writeFile(new URL("data/evidence-audit.json",root),JSON.stringify(audit,null,2));
console.log(JSON.stringify(audit.independentChecks));
