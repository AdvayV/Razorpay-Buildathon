import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Expected a Next.js command such as dev, build, or start.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [nextCli, command, ...args], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1",
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
