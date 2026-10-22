import {spawn} from 'node:child_process';
const root=new URL('../../../',import.meta.url);
for(const script of ['acquire.py','build.py','archive.py','verify.mjs']){
 const status=await new Promise((resolve,reject)=>{
  const child=spawn(script.endsWith('.py')?'python':process.execPath,[`scripts/research/v5/${script}`],{cwd:root,stdio:'inherit'});
  child.on('error',reject);child.on('exit',resolve);
 });
 if(status!==0)throw new Error(`${script} failed; the previously verified public artifact is retained`);
}
