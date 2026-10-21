import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const flags = process.argv.includes("--allow-gaps") ? ["--allow-gaps"] : [];
for (const [program, args] of [
  ["python", ["scripts/research/v3/features.py", ...flags]],
  ["python", ["scripts/research/v3/backtest.py", ...flags]],
  [process.execPath, ["scripts/research/v3/verify.mjs"]],
]) {
  const result = spawnSync(program, args, {cwd: root, stdio: "inherit"});
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
