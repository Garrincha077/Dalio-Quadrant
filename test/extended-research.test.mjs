import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderExtendedStudy, extendedChart } from '../extended-research-view.mjs';
const read = path => readFile(new URL('../'+path, import.meta.url), 'utf8');
const reports = await Promise.all(['extended-state','extended-long-state'].map(async n=>JSON.parse(await read(`data/${n}.json`))));

test('extended research input, builder and protocol hashes match the frozen artifacts', async()=>{
  const hash=async path=>createHash('sha256').update(await read(path)).digest('hex');
  for(const r of reports) {
    assert.equal(r.protocolSha256,await hash('scripts/research/extended-state-protocol.md'));
    assert.equal(r.builderSha256,await hash('scripts/research/extended_state.py'));
    assert.equal(r.stateSourceSha256,await hash('data/state-forward.json'));
    assert.equal(r.stateHistory.quadrants.reduce((n,q)=>n+q.months,0),r.stateHistory.months);
    assert.ok(Math.abs(r.stateHistory.quadrants.reduce((n,q)=>n+q.share,0)-1)<1e-12);
  }
});

test('published monthly portfolios and every cost-case chart reconcile with CAGR and sample counts',()=>{
  for(const r of reports) {
    const study=r.returnStudy, cases=study.costCases;
    for(const name of Object.keys(cases['10'].results)) {
      const rows=study.monthlyPortfolios[name];
      assert.equal(rows.length,study.decisions.length);
      const value=rows.reduce((v,p)=>v*(1+p.return),1);
      assert.ok(Math.abs(value**(12/rows.length)-1-cases['10'].results[name].cagr)<1e-10);
    }
    for(const [bps,cost] of Object.entries(cases)) for(const [name,curve] of Object.entries(cost.growthOf100)) {
      assert.equal(curve[0],100);assert.equal(curve.length,study.decisions.length+1);
      assert.ok(Math.abs((curve.at(-1)/100)**(12/(curve.length-1))-1-cost.results[name].cagr)<1e-10);
      assert.match(extendedChart(study,bps),new RegExp(`${bps} basis points`));
    }
  }
});

test('decisions never train on an outcome exiting at or after the traded month',()=>{
  for(const r of reports) for(const d of r.returnStudy.decisions) {
    assert.ok(!d.lastTrainingExit||d.lastTrainingExit<d.decisionMonth);
    assert.ok(d.reference===null||d.reference<d.decisionMonth);
    if(d.status==='ranked') assert.ok(d.trainingLabels>=60);
    if(d.completed12M) assert.ok(d.completed12M.exitMonth<=r.returnStudy.lastPriceMonth);
  }
});

test('long proxy coverage stops at its actual source cutoff and is distinct from ETF history',()=>{
  const [etf,long]=reports;
  assert.equal(Object.keys(etf.returnStudy.assets).length,5);
  assert.equal(Object.keys(long.returnStudy.assets).length,4);
  assert.equal(long.returnStudy.panelVersion,'long-public-proxy-1');
  assert.equal(long.returnStudy.lastPriceMonth,'2025-05');
  assert.equal(long.targetLongHistory.status,'partial-coverage');
  assert.equal(long.returnStudy.executionBasis,'monthly-proxies-not-executable-closes');
  assert.ok(long.returnStudy.assets.TREASURY.reconstructed);
});

test('rendered results disclose revision bias, proxy limitations and absent prospective confirmation',()=>{
  assert.match(renderExtendedStudy(reports[0]),/not a publication-vintage test/);
  assert.match(renderExtendedStudy(reports[1]),/not executable month-end prices/);
  assert.match(renderExtendedStudy(reports[1]),/edge: unconfirmed/);
  assert.match(renderExtendedStudy({returnStudy:{status:'not-run'}}),/No strategy result/);
  const malicious=structuredClone(reports[1]);
  malicious.returnStudy.assets.EQUITY.instrument='<script>alert(1)</script>';
  assert.ok(!renderExtendedStudy(malicious).includes('<script>'));
});
