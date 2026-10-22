import {spawn} from 'node:child_process';
const root=new URL('../../../',import.meta.url);
for(const script of ['experiment.py','risk.py','policy.py','verify.mjs']){
 const command=script.endsWith('.py')?'python':process.execPath;
 const status=await new Promise((resolve,reject)=>{
  const child=spawn(command,[`scripts/research/v4/${script}`],{cwd:root,stdio:'inherit'});
  child.on('error',reject);child.on('exit',resolve);
 });
 if(status!==0)throw new Error(`${script} failed; the previously verified public artifact is retained`);
}
