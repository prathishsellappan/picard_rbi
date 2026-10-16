// Lightweight indexer for one scenario. It copies two things from the chain into Postgres:
//   1. top-level transactions sent from or to a known scenario address or scenario contract
//      (found by scanning each block, since RPC nodes can't list an address's history), and
//   2. every event emitted by the scenario contracts (factory, marketplace, NFT, all projects).
// Internal ETH movements (marketplace → project, project → creator) are covered by events.
//
// No Next.js imports, so it runs both from the CLI runner (scripts/indexer.ts) and from the
// organizer's "Sync now" route. Safe to re-run: writes are idempotent and the cursor only moves
// forward after a range is fully stored.
import {
  Contract,
  Interface,
  getAddress,
  type Block,
  type JsonRpcProvider,
  type Log,
  type TransactionResponse,
} from "ethers";
import MarketplaceAbi from "../lib/abi/Marketplace.json" with { type: "json" };
import ProjectAbi from "../lib/abi/Project.json" with { type: "json" };
import ProjectFactoryAbi from "../lib/abi/ProjectFactory.json" with { type: "json" };
import ScenarioNFTAbi from "../lib/abi/ScenarioNFT.json" with { type: "json" };

export type Queryable = { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };

export type ContractKind = "factory" | "marketplace" | "nft" | "project";

export const INTERFACES: Record<ContractKind, Interface> = {
  factory: new Interface(ProjectFactoryAbi),
  marketplace: new Interface(MarketplaceAbi),
  nft: new Interface(ScenarioNFTAbi),
  project: new Interface(ProjectAbi),
};

export type IndexResult = {
  fromBlock: number;
  toBlock: number;
  txs: number;
  events: number;
  upToDate: boolean;
};

type ScenarioRow = {
  start_block: string | null;
  factory_address: string | null;
  marketplace_address: string | null;
  nft_address: string | null;
  last_block: string | null;
};

// Decoded event args as plain JSON (bigints as decimal strings, addresses checksummed).
function jsonArg(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonArg);
  return value;
}

export function decodeMethod(
  kind: ContractKind | undefined,
  tx: Pick<TransactionResponse, "to" | "data" | "value">,
): string {
  if (tx.to === null) return "contract creation";
  if (tx.data === "0x") return "transfer";
  if (kind) {
    try {
      const parsed = INTERFACES[kind].parseTransaction({ data: tx.data, value: tx.value });
      if (parsed) return parsed.name;
    } catch {
      // fall through to the selector
    }
  }
  return tx.data.slice(0, 10);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// Indexes the next range of blocks (at most `maxBlocks`) for the scenario. `db` must be a single
// connection (pg Client or PoolClient) because the range is written in one transaction.
export async function indexOnce(
  db: Queryable,
  provider: JsonRpcProvider,
  scenarioId: number,
  { maxBlocks = 200, confirmations = 0 }: { maxBlocks?: number; confirmations?: number } = {},
): Promise<IndexResult> {
  const { rows } = await db.query(
    `SELECT s.start_block::text, s.factory_address, s.marketplace_address, s.nft_address, st.last_block::text
       FROM scenarios s LEFT JOIN indexer_state st ON st.scenario_id = s.id WHERE s.id = $1`,
    [scenarioId],
  );
  const scenario = rows[0] as ScenarioRow | undefined;
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found.`);
  if (!scenario.start_block || !scenario.factory_address || !scenario.marketplace_address || !scenario.nft_address) {
    throw new Error("The scenario contracts are not deployed yet (no start block). Run the deploy script first.");
  }

  const fromBlock = scenario.last_block !== null ? Number(scenario.last_block) + 1 : Number(scenario.start_block);
  const head = (await provider.getBlockNumber()) - confirmations;
  if (fromBlock > head) return { fromBlock, toBlock: head, txs: 0, events: 0, upToDate: true };
  const toBlock = Math.min(head, fromBlock + maxBlocks - 1);

  // Contracts to watch: the three fixed ones plus every project the factory knows at toBlock.
  const factory = new Contract(scenario.factory_address, INTERFACES.factory, provider);
  const projects = (await factory.getProjects({ blockTag: toBlock })) as string[];
  const contractKinds = new Map<string, ContractKind>([
    [scenario.factory_address.toLowerCase(), "factory"],
    [scenario.marketplace_address.toLowerCase(), "marketplace"],
    [scenario.nft_address.toLowerCase(), "nft"],
    ...projects.map((p) => [p.toLowerCase(), "project"] as [string, ContractKind]),
  ]);

  const known = new Set(contractKinds.keys());
  const knownRows = await db.query("SELECT address FROM known_addresses WHERE scenario_id = $1", [scenarioId]);
  for (const r of knownRows.rows) known.add(String(r.address).toLowerCase());

  const logs: Log[] = await provider.getLogs({
    address: [...contractKinds.keys()].map((a) => getAddress(a)),
    fromBlock,
    toBlock,
  });
  const logTxs = new Set(logs.map((l) => l.transactionHash));

  const blockNumbers = Array.from({ length: toBlock - fromBlock + 1 }, (_, i) => fromBlock + i);
  const blocks = await mapLimit(blockNumbers, 8, async (n) => {
    const block = await provider.getBlock(n, true);
    if (!block) throw new Error(`Block ${n} not available from the RPC node.`);
    return block;
  });
  const blockTime = new Map<number, Date>(blocks.map((b: Block) => [b.number, new Date(b.timestamp * 1000)]));

  const touchesScenario = (tx: TransactionResponse) =>
    known.has(tx.from.toLowerCase()) || (tx.to !== null && known.has(tx.to.toLowerCase())) || logTxs.has(tx.hash);
  const allTxs = blocks.flatMap((b) => b.prefetchedTransactions);
  // Contract deployments (to = null) are kept when they created a scenario contract, so every
  // contract's deployment transaction is in the index even if its constructor emits no event.
  const creations = allTxs.filter((tx) => tx.to === null && !touchesScenario(tx));
  const creationReceipts = await mapLimit(creations, 8, (tx) => provider.getTransactionReceipt(tx.hash));
  const createdScenarioContract = new Set(
    creations
      .filter((_, i) => {
        const created = creationReceipts[i]?.contractAddress;
        return created ? known.has(created.toLowerCase()) : false;
      })
      .map((tx) => tx.hash),
  );
  const relevant = allTxs.filter((tx) => touchesScenario(tx) || createdScenarioContract.has(tx.hash));
  const receipts = await mapLimit(relevant, 8, (tx) => provider.getTransactionReceipt(tx.hash));

  const txRows = relevant.map((tx, i) => {
    const receipt = receipts[i];
    return [
      scenarioId,
      tx.hash,
      tx.blockNumber,
      blockTime.get(tx.blockNumber!)!,
      tx.index,
      tx.from,
      tx.to,
      tx.value.toString(),
      receipt ? receipt.status : null,
      receipt ? receipt.gasUsed.toString() : null,
      decodeMethod(tx.to ? contractKinds.get(tx.to.toLowerCase()) : undefined, tx),
      receipt?.contractAddress ?? null,
    ];
  });

  const eventRows = logs.flatMap((log) => {
    const kind = contractKinds.get(log.address.toLowerCase())!;
    const parsed = INTERFACES[kind].parseLog(log);
    if (!parsed) return [];
    const args = Object.fromEntries(parsed.fragment.inputs.map((input, i) => [input.name, jsonArg(parsed.args[i])]));
    return [
      [
        scenarioId,
        log.transactionHash,
        log.index,
        log.blockNumber,
        blockTime.get(log.blockNumber)!,
        log.address,
        kind,
        parsed.name,
        JSON.stringify(args),
      ],
    ];
  });

  await db.query("BEGIN");
  try {
    for (const row of txRows) {
      await db.query(
        `INSERT INTO chain_txs (scenario_id, hash, block_number, block_time, tx_index, from_address, to_address,
                                value_wei, status, gas_used, method, created_contract)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (scenario_id, hash) DO UPDATE SET status = EXCLUDED.status, gas_used = EXCLUDED.gas_used`,
        row,
      );
    }
    for (const row of eventRows) {
      await db.query(
        `INSERT INTO chain_events (scenario_id, tx_hash, log_index, block_number, block_time, contract_address,
                                   contract_kind, event_name, args)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
        row,
      );
    }
    await db.query(
      `INSERT INTO indexer_state (scenario_id, last_block) VALUES ($1, $2)
       ON CONFLICT (scenario_id) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = now()`,
      [scenarioId, toBlock],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  return { fromBlock, toBlock, txs: txRows.length, events: eventRows.length, upToDate: toBlock === head };
}

// Indexes until caught up with the chain head (or `maxRounds` ranges, to bound one call).
export async function indexToHead(
  db: Queryable,
  provider: JsonRpcProvider,
  scenarioId: number,
  options: { maxBlocks?: number; confirmations?: number; maxRounds?: number } = {},
) {
  const totals = { txs: 0, events: 0, toBlock: 0, upToDate: false };
  for (let round = 0; round < (options.maxRounds ?? 50); round++) {
    const result = await indexOnce(db, provider, scenarioId, options);
    totals.txs += result.txs;
    totals.events += result.events;
    totals.toBlock = result.toBlock;
    if (result.upToDate) {
      totals.upToDate = true;
      break;
    }
  }
  return totals;
}

// Deeper confirmation on Sepolia avoids storing blocks that a small reorg could replace.
export function confirmationsFor(chainId: number): number {
  return chainId === 31337 ? 0 : 3;
}
