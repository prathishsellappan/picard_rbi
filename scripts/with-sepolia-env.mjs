// Runs an npm script with the Sepolia settings from web/.env.sepolia instead of web/.env.local,
// so the local demo's configuration is never touched:
//
//   npm run sepolia -- db:migrate
//   npm run sepolia -- provision -- --name "Frosties – Sepolia" --exchange1 0x…
//   npm run sepolia -- preflight:sepolia -w contracts
//
// Variables already set in the environment win over the file, and the child scripts' own
// web/.env.local loading never overrides them, so everything downstream sees Sepolia.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, "web", ".env.sepolia");
if (!existsSync(envFile)) {
  console.error("web/.env.sepolia not found. Copy web/.env.sepolia.example to web/.env.sepolia and fill it in.");
  process.exit(1);
}
process.loadEnvFile(envFile);
if (process.env.NEXT_PUBLIC_CHAIN_ID !== "11155111") {
  console.error("web/.env.sepolia must set NEXT_PUBLIC_CHAIN_ID=11155111.");
  process.exit(1);
}
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npm run sepolia -- <npm script> [args…]");
  process.exit(1);
}
console.log(`[sepolia] npm run ${args.join(" ")}`);
const result = spawnSync("npm", ["run", ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32", // npm is a .cmd file on Windows
});
process.exit(result.status ?? 1);
