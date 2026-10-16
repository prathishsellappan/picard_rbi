// One command to run the whole role-play on this machine:   npm run local
//
//   1. checks web/.env.local (local chain only) and Postgres, applies migrations
//   2. starts the local Hardhat chain (or reuses one already running on port 8545)
//   3. seeds the local scenario if none exists
//   4. if the chain is fresh (contracts missing), clears the scenario's chain data and redeploys,
//      registers creators and funds all wallets — logins and passwords stay the same
//   5. writes MetaMask import keys, then runs the indexer and the web app until Ctrl+C
//
// Chain output goes to .local/hardhat-node.log (it logs every RPC call).
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");
const webEnv = path.join(root, "web", ".env.local");
const RPC = "http://127.0.0.1:8545";
const children = [];

function fail(message) {
  console.error(`\n✖ ${message}`);
  for (const child of children) child.kill();
  process.exit(1);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

function npm(args, label) {
  const result = spawnSync("npm", args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) fail(`${label} failed (see output above).`);
}

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()).result;
}

async function chainUp() {
  try {
    return (await rpc("eth_chainId")) === "0x7a69";
  } catch {
    return false;
  }
}

function prefixed(child, label) {
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) if (line.trim()) console.log(`[${label}] ${line}`);
    });
  }
}

// 1. Environment and database.
step("Checking configuration and database");
if (!existsSync(webEnv)) {
  copyFileSync(path.join(root, "web", ".env.example"), webEnv);
  console.log("created web/.env.local from web/.env.example");
}
process.loadEnvFile(webEnv);
if (process.env.NEXT_PUBLIC_CHAIN_ID !== "31337") {
  fail("npm run local is for the local chain only. Set NEXT_PUBLIC_CHAIN_ID=31337 in web/.env.local.");
}
try {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.end();
} catch (error) {
  fail(`Can't reach Postgres at ${process.env.DATABASE_URL} (${error.message}).\n  Start it with: brew services start postgresql@17`);
}
npm(["run", "db:migrate"], "Database migration");

// 2. Local chain.
step("Starting the local chain");
if (await chainUp()) {
  console.log(`reusing the chain already running at ${RPC}`);
} else {
  mkdirSync(path.join(root, ".local"), { recursive: true });
  const log = createWriteStream(path.join(root, ".local", "hardhat-node.log"));
  const node = spawn("npx", ["hardhat", "node"], { cwd: path.join(root, "contracts"), stdio: ["ignore", "pipe", "pipe"] });
  node.stdout.pipe(log);
  node.stderr.pipe(log);
  node.on("exit", (code) => code !== null && code !== 0 && fail("The Hardhat node stopped (see .local/hardhat-node.log)."));
  children.push(node);
  for (let i = 0; i < 120 && !(await chainUp()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await chainUp())) fail("The local chain did not start (see .local/hardhat-node.log).");
  console.log(`local chain running at ${RPC} (chain 31337); log: .local/hardhat-node.log`);
}

// 3–4. Scenario and contracts.
step("Preparing the local scenario");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let scenario = (await db.query("SELECT id, factory_address FROM scenarios WHERE is_active AND chain_id = 31337")).rows[0];
if (!scenario) {
  npm(["run", "db:seed"], "Seeding");
  scenario = (await db.query("SELECT id, factory_address FROM scenarios WHERE is_active AND chain_id = 31337")).rows[0];
}
const code = scenario.factory_address ? await rpc("eth_getCode", [scenario.factory_address, "latest"]) : "0x";
await db.end();
if (code && code !== "0x") {
  console.log("contracts already deployed on this chain");
} else {
  if (scenario.factory_address) npm(["run", "chain:reset-local", "-w", "web"], "Clearing old chain data");
  npm(["run", "deploy:local", "-w", "contracts"], "Deploying contracts");
  npm(["run", "register-creators:local", "-w", "contracts"], "Registering creators");
  npm(["run", "fund:local", "-w", "contracts"], "Funding wallets");
}
npm(["run", "local:keys", "-w", "web"], "Writing MetaMask keys");

// 5. Indexer and web app.
step("Starting the indexer and the web app");
const indexer = spawn("npm", ["run", "indexer", "-w", "web"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
prefixed(indexer, "indexer");
children.push(indexer);
const web = spawn("npm", ["run", "dev", "-w", "web"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
prefixed(web, "web");
children.push(web);
web.on("exit", (code) => code !== 0 && code !== null && fail("The web app stopped (is port 3000 already in use?)."));

const cards = path.join(root, "organizer-secrets", "credentials-local.csv");
console.log(`
────────────────────────────────────────────────────────────────
 Picard role-play is starting on this machine (test ETH only)

   App:          http://localhost:3000
   Login cards:  organizer-secrets/credentials-local.csv ${existsSync(cards) ? "" : "(missing — run npm run db:seed -- --reset)"}
   MetaMask:     network RPC http://127.0.0.1:8545, chain ID 31337, symbol ETH
   Wallet keys:  organizer-secrets/local-wallet-keys.csv
   User guide:   docs/USER-GUIDE.md   Organizer guide: docs/ORGANIZER-GUIDE.md

 Press Ctrl+C to stop everything. Stopping the chain erases it; the next
 npm run local redeploys automatically and keeps the same logins.
────────────────────────────────────────────────────────────────
`);

const stop = () => {
  console.log("\nStopping…");
  for (const child of children) child.kill("SIGINT");
  setTimeout(() => process.exit(0), 1500);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Keep the process alive while children run.
setInterval(() => {}, 1 << 30);
