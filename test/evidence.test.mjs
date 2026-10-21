import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { filterResearchRows, rankIC, evaluateRankingRows, validDateRange } from "../lib/research-evidence.mjs";
import { vintagePoints } from "../scripts/research/v2/vintage-points.mjs";

test("point-in-time inputs cannot borrow a current revision or an unavailable vintage", () => {
  const source={availableCutoffs:["2005-01-30"],observations:[{date:"2004-12-01",X_20050130:"2",X_20261021:"999"},{date:"2005-02-01",X_20050130:"3"}],latest:[{date:"2004-12-01",value:"999"}]};
  assert.deepEqual(vintagePoints(source,"X","2005-01-30"),[{date:"2004-12-01",value:2}]);
  assert.deepEqual(vintagePoints(source,"X","2004-12-30"),[]);
  source.latest[0].value="-999";source.observations[0].X_20261021="-999";
  assert.equal(vintagePoints(source,"X","2005-01-30")[0].value,2);
});
test("Chicago substitution requires a released archive; future releases cannot change past inputs", () => {
  const archives=[{releasedAt:"2001-03-05",observations:[{date:"2001-01-01",value:-.5}]},{releasedAt:"2001-04-03",observations:[{date:"2001-01-01",value:5}]}];
  assert.deepEqual(vintagePoints(null,"CFNAIMA3","2001-03-01",archives),[]);
  assert.equal(vintagePoints(null,"CFNAIMA3","2001-03-30",archives)[0].value,-.5);
  assert.deepEqual(vintagePoints(null,"PCEPI","2001-03-30",archives),[]);
});
test("rank correlation treats ties as ties and withholds incomplete outcomes", () => {
  assert.equal(rankIC([1,2,3],[3,2,1]),-1);
  assert.equal(rankIC([1,1,3],[1,1,3]),1);
  assert.equal(rankIC([1,1,1],[1,2,3]),null);
  assert.equal(rankIC([1,2,3],[1,null,3]),null);
});
test("view dates do not mutate forecasts, training membership or the common cohort", () => {
  const rows=[{month:"2000-01",common:true,predictions:{state:[1,2,3]},outcomes:[3,2,1]}, {month:"2025-01",common:true,predictions:{state:[1,2,3]},outcomes:[1,2,3]}, {month:"2025-02",common:false,predictions:{state:[1,2,3]},outcomes:[3,2,1]}];
  const original=JSON.stringify(rows);
  assert.equal(filterResearchRows(rows,{period:"last20"}).length,2);
  const selected=filterResearchRows(rows,{period:"custom",start:"2025-01",end:"2025-02"});
  assert.deepEqual(evaluateRankingRows(selected,"state"),{n:1,first:"2025-01",last:"2025-01",meanRankIC:1});
  assert.equal(JSON.stringify(rows),original);
  assert.equal(validDateRange("2025-02","2025-01"),false);
  assert.equal(validDateRange("2025-13",""),false);
});
test("published v2 protocol and matched cohorts reconcile independently, while early history stays descriptive", async () => {
  const d=JSON.parse(await readFile(new URL("../data/research-v2.json",import.meta.url)));
  const protocol=await readFile(new URL("../scripts/research/v2/protocol.md",import.meta.url));
  assert.equal(createHash("sha256").update(protocol).digest("hex"),d.protocolSha256);
  assert.equal(d.status,"retrospective-walk-forward");
  for(const study of Object.values(d.horizons)) {
    const counts=["state","momentum","combined","unconditional"].map((m) => study.models[m].n);
    assert.equal(new Set(counts).size,1);
    for(const model of ["state","momentum","combined","unconditional"]) {
      const result=evaluateRankingRows(study.forecastRows,model);
      assert.equal(result.n,study.models[model].n);
      assert.ok(Math.abs(result.meanRankIC-study.models[model].meanRankIC)<1e-12);
    }
    for(const r of study.forecastRows) {
      assert.ok(r.cutoff<r.tradeDate);
      for(const [m,p] of Object.entries(r.predictions)) if(p.every(Number.isFinite)) assert.ok(r.training[m]>=60);
    }
  }
  const history=JSON.parse(await readFile(new URL("../data/research-history.json",import.meta.url)));
  assert.equal(history.points[0].month,"1967-05");
  assert.equal(history.annualContext.metadata.frequency,"annual");
  assert.equal(history.annualContext.rows[0].equity,null);
  assert.ok(history.equityProxy.cohorts["12"].n>d.horizons["12"].models.combined.n);
});
