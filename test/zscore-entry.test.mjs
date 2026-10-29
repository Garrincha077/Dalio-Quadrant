import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zscoreModelScore,zscoreResults} from '../zscore-entry-view.mjs';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url));
const data=JSON.parse(await read('data/zscore-entry.json'));
const hash=async p=>createHash('sha256').update(await read(p)).digest('hex');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;

test('price study retains frozen sources, two declared windows and four matched families',async()=>{
 assert.equal(data.builderSha256,await hash('scripts/research/zscore_entry.py'));
 assert.equal(data.protocolSha256,await hash('scripts/research/zscore-entry-protocol.md'));
 assert.equal(data.stateSourceSha256,await hash('data/state-forward.json'));
 for(const [p,h] of Object.entries(data.dependencies))assert.equal(h,await hash('scripts/research/'+p));
 assert.equal(data.primaryWindow,36);assert.deepEqual(data.windows,[36,60]);assert.equal(data.panels.length,8);
 assert.deepEqual(data.policies,['macro','price','joint','interaction']);assert.equal(data.bootstrapDraws,5000);
});

test('every family return and paired incremental lift reconciles on identical dates',()=>{
 for(const p of data.panels)for(const t of p.targets){
  const refs=new Map(t.refits.map(f=>[f.refitMonth.slice(0,4),f])),averages={};
  for(const k of data.policies){
   const selected=t.forecasts.filter(row=>{const m=p.models[refs.get(row.entry.slice(0,4)).models[k]],s=zscoreModelScore(m,row.x);return s>1e-12&&s>=m.threshold-1e-12;});
   const r=t.results[k];assert.equal(r.nScored,t.forecasts.length);assert.equal(r.selectedStarts,selected.length);
   averages[k]=selected.length?mean(selected.map(r=>r.actual)):null;
   if(selected.length){close(r.mean,averages[k]);close(r.lift,r.mean-mean(t.forecasts.map(r=>r.actual)));}
   else{assert.equal(r.mean,null);assert.equal(r.lift,null);}
  }
  for(const [k,r] of Object.entries(t.incremental)){
   if(averages[k]===null||averages.macro===null)assert.equal(r.gain,null);
   else close(r.gain,averages[k]-averages.macro);
   assert.equal(r.supported,t.results[k].supported&&t.results.macro.supported);
  }
 }
});

test('every price family choice uses earlier validation or its matching declared fallback',()=>{
 for(const p of data.panels)for(const t of p.targets)for(const f of t.refits)for(const k of data.policies){
  const m=p.models[f.models[k]];assert.ok(m.lastTrainingExit<m.refitMonth);assert.ok(m.n>=60);
  assert.equal(m.window,p.window);assert.equal(m.information,p.information);
  if(p.information==='vintage')assert.equal(m.vintageCutoff.slice(0,7),m.refitMonth);
  if(f.fallback)assert.equal(m.spec.id,k+':100:0');
  else{
   assert.ok(f.lastValidationExit<f.refitMonth);assert.ok(f.folds>=3&&f.nValidation>=24);
   const winners=f.candidates.filter(r=>r.family===k&&r.entryStarts>=12&&r.entryEpisodes>=3&&r.entryLift>0).sort((a,b)=>b.entryLift-a.entryLift||(a.id<b.id?-1:a.id>b.id?1:0));
   assert.equal(m.spec.id,winners[0]?.id??'unconditional');
  }
 }
});

test('Holm family includes both windows and supported absolute and incremental tests',()=>{
 for(const info of ['revised','vintage'])for(const panel of ['long','etf']){
  const rows=data.panels.filter(p=>p.information===info&&p.panel===panel).flatMap(p=>p.targets.flatMap(t=>[...Object.values(t.results),...Object.values(t.incremental)]));
  const eligible=rows.filter(r=>r.supported&&r.bootstrapP!=null).sort((a,b)=>a.bootstrapP-b.bootstrapP);let current=0;
  eligible.forEach((r,i)=>{current=Math.max(current,(eligible.length-i)*r.bootstrapP);close(r.holmP,Math.min(1,current));});
  for(const r of rows.filter(r=>!r.supported||r.bootstrapP==null))assert.equal(r.holmP,null);
 }
});

test('public CSV carries all four dated decisions and UI reports missing results',async()=>{
 const csv=(await read('data/zscore-entry.csv')).toString().trimEnd().split('\n');
 assert.equal(csv.length,1+4*data.panels.reduce((n,p)=>n+p.targets.reduce((n,t)=>n+t.forecasts.length,0),0));
 assert.match(csv[0],/zscore,actual,procedure,score,enter,model/);
 const t=data.panels.find(p=>p.panel==='etf'&&p.information==='vintage'&&p.window===36).targets.find(t=>t.asset==='SPY'&&t.horizon===12);
 assert.match(zscoreResults(t),/matched control/);assert.match(zscoreResults(t),/Holm p/);
});
