// Organizer-run indexer for the active scenario on the configured chain.
//   npm run indexer            keep indexing, polling for new blocks
//   npm run indexer -- --once  index up to the current head and exit
import { JsonRpcProvider } from "ethers";
import pg from "pg";
import { confirmationsFor, indexToHead } from "../indexer/core.ts";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
if (chainId !== 31337 && chainId !== 11155111) {
  console.error("NEXT_PUBLIC_CHAIN_ID must be 31337 or 11155111.");
  process.exit(1);
}
if (!process.env.DATABASE_URL || !process.env.RPC_URL) {
  console.error("DATABASE_URL and RPC_URL must be set (web/.env.local).");
  process.exit(1);
}
const once = process.argv.includes("--once");

const provider = new JsonRpcProvider(process.env.RPC_URL, chainId, { staticNetwork: true, cacheTimeout: -1 });
const actual = Number(await provider.send("eth_chainId", []));
if (actual !== chainId) {
  console.error(`RPC_URL serves chain ${actual}, but NEXT_PUBLIC_CHAIN_ID is ${chainId}. Refusing to index.`);
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const scenario = await db.query<{ id: number; name: string }>(
  "SELECT id, name FROM scenarios WHERE is_active AND chain_id = $1",
  [chainId],
);
if (!scenario.rows[0]) {
  console.error(`No active scenario for chain ${chainId}.`);
  process.exit(1);
}
const { id, name } = scenario.rows[0];
console.log(`Indexing "${name}" (scenario #${id}) on chain ${chainId}${once ? " once" : "; Ctrl+C to stop"}`);

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});

try {
  do {
    const result = await indexToHead(db, provider, id, { confirmations: confirmationsFor(chainId) });
    if (result.txs || result.events) {
      console.log(`  up to block ${result.toBlock}: +${result.txs} txs, +${result.events} events`);
    }
    if (!once) await new Promise((r) => setTimeout(r, 4000));
  } while (!once && !stopping);
} finally {
  await db.end();
  provider.destroy();
}
