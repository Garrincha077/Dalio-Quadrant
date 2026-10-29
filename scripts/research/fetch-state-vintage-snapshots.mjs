// Fetch actual ALFRED information sets without exposing the server-side API key.
// Invoked manually by GitHub Actions on the research branch; never on page load.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const directory = new URL('../../work/research/state-vintages/', import.meta.url);
await fs.mkdir(directory, {recursive:true});
const key = process.env.FRED_API_KEY;
const manifest={version:'state-vintage-snapshots-1',scheduleSha256:null,series:{},snapshots:[],unavailable:[],failures:[]};
async function saveManifest(){await fs.writeFile(new URL('manifest.json',directory),JSON.stringify(manifest,null,2)+'\n');}
if(!key){manifest.failures.push({reason:'Repository Actions secret FRED_API_KEY is unavailable.'});await saveManifest();throw new Error('Server-side FRED_API_KEY is required.');}
async function request(endpoint,params){
 await new Promise(resolve=>setTimeout(resolve,650));
 const url=new URL('https://api.stlouisfed.org/fred/'+endpoint);
 url.search=new URLSearchParams({...params,api_key:key,file_type:'json'});
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 const json=await response.json();
 if(!response.ok)throw new Error(String(json.error_message||`FRED HTTP ${response.status}`).replaceAll(key,'[redacted]'));
 return json;
}
const scheduleBytes=await fs.readFile(new URL('state-vintage-schedule.json',import.meta.url));
manifest.scheduleSha256=crypto.createHash('sha256').update(scheduleBytes).digest('hex');
const schedule=JSON.parse(scheduleBytes);
for(const id of ['CFNAIMA3','PCEPI']){
 const first=await request('series/vintagedates',{series_id:id,sort_order:'asc',limit:'1'});
 if(!first.vintage_dates?.length)throw new Error('No archived vintage date for '+id);
 manifest.series[id]={firstVintage:first.vintage_dates[0],source:'https://fred.stlouisfed.org/series/'+id};
}
for(const row of schedule){
 if(Object.values(manifest.series).some(s=>s.firstVintage>row.cutoff)){
  manifest.unavailable.push({cutoff:row.cutoff,reason:'Predates at least one archived FRED vintage.'});continue;
 }
 try{
  const series={};
  for(const id of ['CFNAIMA3','PCEPI']){
   const data=await request('series/observations',{series_id:id,observation_start:'1966-01-01',observation_end:row.cutoff,realtime_start:row.cutoff,realtime_end:row.cutoff,limit:'100000',sort_order:'asc'});
   if(data.count!==data.observations?.length)throw new Error('Incomplete vintage response for '+id);
   series[id]={source:manifest.series[id].source,observations:data.observations};
  }
  const body=JSON.stringify({cutoff:row.cutoff,tradeDate:row.tradeDate,source:'FRED/ALFRED exact realtime_start=realtime_end=cutoff',series})+'\n';
  await fs.writeFile(new URL(row.cutoff+'.json',directory),body);
  manifest.snapshots.push({cutoff:row.cutoff,entryMonth:row.entryMonth,sha256:crypto.createHash('sha256').update(body).digest('hex')});
  if(manifest.snapshots.length%12===0)console.log(manifest.snapshots.length,'complete monthly snapshots; latest',row.cutoff);
 }catch(error){
  manifest.failures.push({cutoff:row.cutoff,reason:String(error.message).replaceAll(key,'[redacted]').slice(0,200)});
 }
 await saveManifest();
}
await saveManifest();
console.log(JSON.stringify({complete:manifest.snapshots.length,unavailable:manifest.unavailable.length,failures:manifest.failures.length,firstVintages:manifest.series}));
if(manifest.failures.length)process.exitCode=1;
