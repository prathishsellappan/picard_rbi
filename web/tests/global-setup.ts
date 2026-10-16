// Before the test run: recreate the test database schema, apply migrations, and start a
// throwaway Hardhat node on port 8546 for transaction-verification tests.
// Uses TEST_DATABASE_URL (default postgres://localhost:5432/picard_test) — never the dev database.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import pg from "pg";

export const TEST_RPC_PORT = 8546;

async function waitForRpc(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Hardhat test node did not start on ${url}`);
}

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/picard_test";
  if (!url.endsWith("_test")) throw new Error("Refusing to reset a database whose name doesn't end in _test");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();

  execFileSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "migrate.ts")], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });

  const contractsDir = path.join(import.meta.dirname, "..", "..", "contracts");
  const node: ChildProcess = spawn("npx", ["hardhat", "node", "--port", String(TEST_RPC_PORT)], {
    cwd: contractsDir,
    stdio: "ignore",
  });
  await waitForRpc(`http://127.0.0.1:${TEST_RPC_PORT}`, 60_000);

  return () => {
    node.kill();
  };
}
