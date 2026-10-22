import {loadBottoming} from '../lib/bottoming-live.mjs';
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 if(!process.env.FRED_API_KEY){res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'FRED is not configured on the server.',errorCode:'FRED_NOT_CONFIGURED'});}
 try{
  const snapshot=await loadBottoming(process.env.FRED_API_KEY);
  res.setHeader('Cache-Control',snapshot.complete?'public, max-age=0, s-maxage=1800':'no-store');
  return res.status(200).json(snapshot);
 }catch{
  res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');
  return res.status(503).json({error:'Weekly bottoming inputs could not be refreshed. Saved research remains separately dated.',errorCode:'BOTTOMING_UNAVAILABLE',retryAfterSeconds:60});
 }
}
