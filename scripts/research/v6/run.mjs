import {spawn} from 'node:child_process';
for(const script of ['experiment.py','memory.py','verify.mjs']){
 const status=await new Promise((resolve,reject)=>{const p=spawn(script.endsWith('.py')?'python':process.execPath,[`scripts/research/v6/${script}`],{cwd:new URL('../../../',import.meta.url),stdio:'inherit',env:{...process.env,OPENBLAS_NUM_THREADS:'1'}});p.on('error',reject);p.on('exit',resolve);});
 if(status!==0)throw Error(`${script} failed; earlier public evidence is retained`);
}
