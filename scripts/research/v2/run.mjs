import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEFINITIONS } from "../../../lib/model.mjs";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const mode=process.argv[2];
if(!["sources","build"].includes(mode)) throw new Error("Choose sources or build");
await mkdir(new URL("../../../work/research-v2/prices/",import.meta.url),{recursive:true});
await writeFile(new URL("../../../work/research-v2/definitions.json",import.meta.url),JSON.stringify(DEFINITIONS.filter((d) => ["growth","inflation"].includes(d.group))));
const run=(program,args) => { const r=spawnSync(program,args,{cwd:root,stdio:"inherit"});if(r.error || r.status!==0) process.exit(r.status||1); };
if(mode==="sources") run("python",["scripts/research/v2/acquire.py",...process.argv.slice(3)]);
else {
  run("python",["scripts/research/v2/chicago.py"]);
  run(process.execPath,["scripts/research/v2/build-features.mjs"]);
  run("python",["scripts/research/v2/backtest.py"]);
  run(process.execPath,["scripts/research/v2/verify.mjs"]);
}
