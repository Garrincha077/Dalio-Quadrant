import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {candidateRows,conditionLabel,opportunityOverview,cellDetail,liftChart} from '../entry-opportunities-view.mjs';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url));
const data=JSON.parse(await read('data/entry-opportunities.json'));
const hash=async p=>createHash('sha256').update(await read(p)).digest('hex');

test('entry research is tied to the fixed protocol, builder and existing economic source',async()=>{
 assert.equal(data.version,'entry-opportunities-1');
 assert.deepEqual(data.horizons,[3,12,36]);
 assert.equal(data.builderSha256,await hash('scripts/research/entry_opportunities.py'));
 assert.equal(data.protocolSha256,await hash('scripts/research/entry-opportunities-protocol.md'));
 assert.equal(data.statesSha256,await hash('data/state-forward.json'));
});

test('own-asset baseline is identical across families and cell lifts reconcile exactly',()=>{
 for(const p of data.panels){
  for(const c of p.cells){
   assert.ok(Math.abs(c.baseline-p.cohorts[c.horizon].baseline[c.asset])<1e-12);
   assert.ok(Math.abs(c.mean-c.baseline-c.lift)<1e-12);
   assert.equal(c.supported,c.n>=24&&c.episodes>=6);
   assert.ok(c.nonoverlappingStarts<=c.n);
   assert.ok(c.firstEntry<=c.lastEntry&&c.lastEntry<=p.cohorts[c.horizon].lastEntry);
   if(!c.supported)assert.equal(c.holmP,null);
   if(c.holmP!==null)assert.ok(c.holmP>=c.bootstrapP&&c.holmP<=1);
  }
  assert.equal(p.comparisons,p.cells.length);
 }
});

test('maxima are selected by lift; thin cells remain separately identified',()=>{
 for(const p of data.panels)for(const w of p.winners){
  assert.equal(candidateRows(p,w.asset,w.horizon,w.family,true)[0]?.id??null,w.rawMaximum);
  assert.equal(candidateRows(p,w.asset,w.horizon,w.family)[0]?.id??null,w.supportedMaximum);
 }
});

test('temporal selection purges crossing outcomes and cannot claim unseen windows',()=>{
 for(const p of data.panels)for(const t of p.temporal){
  if(t.condition){assert.ok(t.lastDevelopmentExit<t.split);assert.ok(t.developmentConditionN>=24);assert.match(t.basis,/not untouched holdout/);}
 }
 for(const r of data.sameDateProxyCheck){assert.equal(r.states.reduce((n,s)=>n+s.n,0),r.n);assert.ok(r.lastEntry<=data.panels[0].priceEnd);}
});

test('UI exposes cumulative own-baseline returns, insufficient cases and safe labels',()=>{
 const p=data.panels[1],cell=candidateRows(p,'GLD',12,'state')[0];
 assert.match(opportunityOverview(p,12),/Usual return/);
 assert.match(cellDetail(cell,p),/Holm-adjusted/);
 assert.match(liftChart([],12),/No condition meets/);
 assert.match(liftChart([cell],12),/12-month cumulative/);
 assert.match(conditionLabel('below-above|falling/rising|near/distant'),/activity falling, inflation rising/);
 const unsafe={...cell,condition:'<script>'};assert.ok(!cellDetail(unsafe,p).includes('<script>'));
});
