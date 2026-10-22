import {fetchSeries} from './fred.mjs';
import {weeklyBottomingSnapshot} from './bottoming.mjs';
export async function loadBottoming(key,{now=new Date(),fetchImpl=fetch}={}){
 const start=new Date(now);start.setUTCMonth(start.getUTCMonth()-8);
 const query={start:start.toISOString().slice(0,10),limit:400,fetchImpl,timeoutMs:12000};
 const end=Math.floor(now.getTime()/1000),url=new URL('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC');
 url.search=new URLSearchParams({period1:'0',period2:String(end),interval:'1d',events:'splits'});
 const [index,vix,hy]=await Promise.all([
  (async()=>{
   try{const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}});
    if(!response.ok)return null;const x=(await response.json()).chart?.result?.[0];
    if(x?.meta?.symbol!=='^GSPC'||x.meta.dataGranularity!=='1d')return null;
    const close=x.indicators?.quote?.[0]?.close;if(!Array.isArray(close)||close.length!==x.timestamp?.length)return null;
    return x.timestamp.flatMap((t,i)=>Number.isFinite(close[i])&&close[i]>0?[{date:new Date(t*1000).toISOString().slice(0,10),value:close[i]}]:[]);
   }catch{return null;}
  })(),fetchSeries('VIXCLS',key,query),fetchSeries('BAMLH0A0HYM2',key,query),
 ]);
 if(!index)throw new Error('The daily S&P 500 source is unavailable; weekly RSI could not be refreshed.');
 const snapshot=weeklyBottomingSnapshot({prices:index,vix:vix.observations||[],hy:hy.observations||[],now});
 snapshot.fetchStatus={requested:3,received:1+Number(!!vix.observations?.length)+Number(!!hy.observations?.length),
  code:snapshot.complete?'OK':'PARTIAL_WEEKLY_DATA'};
 return snapshot;
}
