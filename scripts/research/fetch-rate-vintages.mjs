// Collect attributed monthly Treasury yields; no provider prices or secret output.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory=new URL('../../work/research/rate-vintages/',import.meta.url);
await fs.mkdir(directory,{recursive:true});
const key=process.env.FRED_API_KEY;
if(!key)throw new Error('Server-side FRED_API_KEY is required.');
const asOf=process.argv.find(a=>a.startsWith('--as-of='))?.slice(8)||new Date().toISOString().slice(0,10);
const bytes=await fs.readFile(new URL('state-vintage-schedule.json',import.meta.url));
const schedule=JSON.parse(bytes),digest=b=>createHash('sha256').update(b).digest('hex');
const manifest={version:'rate-vintages-1',asOf,scheduleSha256:digest(bytes),series:[],failures:[]};
async function request(endpoint,params){
 await new Promise(resolve=>setTimeout(resolve,650));
 const url=new URL('https://api.stlouisfed.org/fred/'+endpoint);
 url.search=new URLSearchParams({...params,api_key:key,file_type:'json'});
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)}),json=await response.json();
 if(!response.ok)throw new Error(String(json.error_message||response.status).replaceAll(key,'[redacted]'));
 return json;
}
for(const id of ['GS10','FII10']){
 try{
  const vintage=await request('series/vintagedates',{series_id:id,sort_order:'asc',limit:'1'});
  const firstVintage=vintage.vintage_dates?.[0];
  if(!firstVintage)throw new Error('No archive coverage for '+id);
  const source='https://fred.stlouisfed.org/series/'+id;
  const output={version:'monthly-yield-snapshots-1',id,source,firstVintage,snapshots:{},revised:null};
  const cutoffs=schedule.map(r=>r.cutoff).filter(c=>c>=firstVintage&&c<=asOf);
  for(let i=0;i<cutoffs.length;i+=40){
   const dates=cutoffs.slice(i,i+40);
   const data=await request('series/observations',{series_id:id,observation_start:'1953-01-01',
    observation_end:asOf,vintage_dates:dates.join(','),output_type:'2',limit:'100000',sort_order:'asc'});
   if(data.count!==data.observations?.length)throw new Error('Truncated archive response for '+id);
   for(const cutoff of dates){
    const field=id+'_'+cutoff.replaceAll('-','');
    const observations=data.observations.filter(p=>p.date<=cutoff&&Object.hasOwn(p,field))
     .map(p=>({date:p.date,value:p[field]}));
    if(!observations.length)throw new Error('Missing exact vintage column for '+id+' at '+cutoff);
    output.snapshots[cutoff]={cutoff,observations};
   }
  }
  const data=await request('series/observations',{series_id:id,observation_start:'1953-01-01',observation_end:asOf,
   realtime_start:asOf,realtime_end:asOf,limit:'100000',sort_order:'asc'});
  if(data.count!==data.observations?.length)throw new Error('Truncated revised response for '+id);
  output.revised={cutoff:asOf,observations:data.observations.map(p=>({date:p.date,value:p.value}))};
  const body=JSON.stringify(output)+'\n';await fs.writeFile(new URL(id+'.json',directory),body);
  manifest.series.push({id,source,firstVintage,snapshots:cutoffs.length,sha256:digest(body)});
  console.log(id,cutoffs.length,'archived monthly reconstructions; revised cutoff',asOf);
 }catch(error){manifest.failures.push({id,reason:String(error.message).replaceAll(key,'[redacted]').slice(0,180)});}
 await fs.writeFile(new URL('manifest.json',directory),JSON.stringify(manifest,null,2)+'\n');
}
if(manifest.failures.length){console.log(JSON.stringify(manifest.failures));process.exitCode=1;}
