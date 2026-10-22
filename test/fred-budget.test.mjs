import test from "node:test";
import assert from "node:assert/strict";
import { loadDashboard } from "../lib/fred.mjs";
import { SERIES } from "../lib/model.mjs";
const slow = (signal) => new Promise((resolve,reject) => {
  const timer=setTimeout(() => resolve({ok:true,json:async () => ({observations:[]})}),100);
  const abort=() => { clearTimeout(timer);reject(new Error("upstream timed out")); };
  if(signal.aborted) abort();else signal.addEventListener("abort",abort,{once:true});
});
test("a slow upstream cannot consume the entire function lifetime or invent missing data", async () => {
  const calls=[];const started=Date.now();
  const snapshot=await loadDashboard("test-only-key",{timeBudgetMs:20,requestTimeoutMs:100,
    fetchImpl:(url,{signal}) => { calls.push(new URL(url).searchParams.get("series_id"));return slow(signal); }});
  assert.ok(Date.now()-started<2000);
  assert.deepEqual(calls.slice(0,2),["CFNAIMA3","PCEPI"]);
  assert.ok(calls.length<=8);
  assert.equal(snapshot.errors.length,SERIES.length);
  assert.equal(snapshot.regime.id,"unavailable");
  assert.equal(snapshot.economicState.available,false);
  assert.ok(!JSON.stringify(snapshot).includes("test-only-key"));
});
test("fresh anchors survive slow context while timed-out inputs remain excluded", async () => {
  const snapshot=await loadDashboard("test-only-key",{now:new Date("2026-10-20T12:00:00Z"),timeBudgetMs:20,requestTimeoutMs:100,
    fetchImpl:async (url,{signal}) => {
      const id=new URL(url).searchParams.get("series_id");
      if(id==="CFNAIMA3")return{ok:true,json:async()=>({observations:[{date:"2026-08-01",value:".2"}]})};
      if(id==="PCEPI")return{ok:true,json:async()=>({observations:[{date:"2025-08-01",value:"100"},{date:"2026-08-01",value:"103"}]})};
      return slow(signal);
    }});
  assert.equal(snapshot.economicState.available,true);
  assert.equal(snapshot.economicState.activity.value,.2);
  assert.equal(snapshot.errors.includes("CFNAIMA3"),false);
  assert.equal(snapshot.errors.includes("PCEPI"),false);
  assert.equal(snapshot.regime.id,"unavailable");
});
