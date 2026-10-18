import "server-only";
import { getAddress, type Log } from "ethers";
import { INTERFACES, decodeMethod, type ContractKind } from "@/indexer/core";
import { getProvider } from "./chain";
import { query, queryOne } from "./db";

// Read side of the explorer. Lists come from the indexed tables (scenario addresses only);
// a single transaction is always read live from the chain. Wallet labels are set by the organizer
// (known_addresses.public_label; an empty label means the wallet is shown by address only, like the
// unnamed second wallet in the Frosties lab). Roles and the malicious flag are never shown.

export type Labels = Map<string, string>; // lowercase address → label

export async function getLabels(scenarioId: number): Promise<Labels> {
  const labels: Labels = new Map();
  const known = await query<{ address: string; public_label: string }>(
    "SELECT address, public_label FROM known_addresses WHERE scenario_id = $1",
    [scenarioId],
  );
  for (const k of known) if (k.public_label.trim()) labels.set(k.address.toLowerCase(), k.public_label);

  const scenario = await queryOne<{
    factory_address: string | null;
    marketplace_address: string | null;
    nft_address: string | null;
  }>("SELECT factory_address, marketplace_address, nft_address FROM scenarios WHERE id = $1", [scenarioId]);
  if (scenario?.factory_address) labels.set(scenario.factory_address.toLowerCase(), "ProjectFactory");
  if (scenario?.marketplace_address) labels.set(scenario.marketplace_address.toLowerCase(), "Marketplace");
  if (scenario?.nft_address) labels.set(scenario.nft_address.toLowerCase(), "NFT collection");

  const projects = await query<{ project: string; name: string }>(
    `SELECT args->>'project' AS project, args->>'name' AS name FROM chain_events
      WHERE scenario_id = $1 AND event_name = 'ProjectCreated'`,
    [scenarioId],
  );
  for (const p of projects) labels.set(p.project.toLowerCase(), `${p.name} contract`);
  return labels;
}

// Contract kinds by address, for decoding logs of a live transaction.
async function contractKinds(scenarioId: number): Promise<Map<string, ContractKind>> {
  const kinds = new Map<string, ContractKind>();
  const scenario = await queryOne<{
    factory_address: string | null;
    marketplace_address: string | null;
    nft_address: string | null;
  }>("SELECT factory_address, marketplace_address, nft_address FROM scenarios WHERE id = $1", [scenarioId]);
  if (scenario?.factory_address) kinds.set(scenario.factory_address.toLowerCase(), "factory");
  if (scenario?.marketplace_address) kinds.set(scenario.marketplace_address.toLowerCase(), "marketplace");
  if (scenario?.nft_address) kinds.set(scenario.nft_address.toLowerCase(), "nft");
  const projects = await query<{ project: string }>(
    "SELECT args->>'project' AS project FROM chain_events WHERE scenario_id = $1 AND event_name = 'ProjectCreated'",
    [scenarioId],
  );
  for (const p of projects) kinds.set(p.project.toLowerCase(), "project");
  return kinds;
}

export type IndexerStatus = { lastBlock: number | null; updatedAt: string | null; headBlock: number | null };

export async function getIndexerStatus(scenarioId: number): Promise<IndexerStatus> {
  const row = await queryOne<{ last_block: string; updated_at: Date }>(
    "SELECT last_block::text, updated_at FROM indexer_state WHERE scenario_id = $1",
    [scenarioId],
  );
  let headBlock: number | null = null;
  try {
    headBlock = await (await getProvider()).getBlockNumber();
  } catch {
    // RPC unreachable; the page still shows indexed data.
  }
  return {
    lastBlock: row ? Number(row.last_block) : null,
    updatedAt: row ? row.updated_at.toISOString() : null,
    headBlock,
  };
}

export type TxRow = {
  hash: string;
  blockNumber: number;
  blockTime: string;
  from: string;
  to: string | null;
  valueWei: string;
  status: number | null;
  method: string;
  createdContract: string | null;
};

type TxDbRow = {
  hash: string;
  block_number: string;
  block_time: Date;
  from_address: string;
  to_address: string | null;
  value_wei: string;
  status: number | null;
  method: string;
  created_contract: string | null;
};

function toTxRow(r: TxDbRow): TxRow {
  return {
    hash: r.hash,
    blockNumber: Number(r.block_number),
    blockTime: r.block_time.toISOString(),
    from: r.from_address,
    to: r.to_address,
    valueWei: r.value_wei,
    status: r.status,
    method: r.method,
    createdContract: r.created_contract,
  };
}

const TX_COLUMNS =
  "hash, block_number::text, block_time, from_address, to_address, value_wei::text, status, method, created_contract";

export async function recentTxs(scenarioId: number, limit = 50): Promise<TxRow[]> {
  const rows = await query<TxDbRow>(
    `SELECT ${TX_COLUMNS} FROM chain_txs WHERE scenario_id = $1 ORDER BY block_number DESC, tx_index DESC LIMIT $2`,
    [scenarioId, limit],
  );
  return rows.map(toTxRow);
}

// ETH moved inside a transaction by a scenario contract. Not visible as a top-level transaction,
// so it is reconstructed from the contracts' events.
export type InternalTransfer = {
  txHash: string;
  blockNumber: number;
  blockTime: string;
  from: string;
  to: string;
  valueWei: string;
  reason: string;
};

export type NftTransfer = {
  txHash: string;
  blockNumber: number;
  blockTime: string;
  from: string;
  to: string;
  tokenId: string;
};

type EventDbRow = {
  tx_hash: string;
  log_index: number;
  block_number: string;
  block_time: Date;
  contract_address: string;
  contract_kind: ContractKind;
  event_name: string;
  args: Record<string, string>;
};

async function marketplaceAddress(scenarioId: number): Promise<string | null> {
  const row = await queryOne<{ marketplace_address: string | null }>(
    "SELECT marketplace_address FROM scenarios WHERE id = $1",
    [scenarioId],
  );
  return row?.marketplace_address ?? null;
}

function internalFromEvent(e: EventDbRow, marketplace: string | null): InternalTransfer | null {
  const base = { txHash: e.tx_hash, blockNumber: Number(e.block_number), blockTime: e.block_time.toISOString() };
  if (e.event_name === "FundsReceived" && marketplace) {
    return {
      ...base,
      from: marketplace,
      to: e.contract_address,
      valueWei: e.args.amount,
      reason: "Mint payment routed to project",
    };
  }
  if (e.event_name === "Withdrawn") {
    return { ...base, from: e.contract_address, to: e.args.to, valueWei: e.args.amount, reason: "Project withdrawal" };
  }
  return null;
}

export type AddressHistory = {
  txs: TxRow[];
  internal: InternalTransfer[];
  nftTransfers: NftTransfer[];
  emittedEvents: { txHash: string; blockNumber: number; eventName: string; args: Record<string, string> }[];
};

export async function addressHistory(scenarioId: number, address: string): Promise<AddressHistory> {
  const lower = address.toLowerCase();
  const [txRows, moneyEvents, nftEvents, emitted, marketplace] = await Promise.all([
    query<TxDbRow>(
      `SELECT ${TX_COLUMNS} FROM chain_txs
        WHERE scenario_id = $1 AND (lower(from_address) = $2 OR lower(to_address) = $2 OR lower(created_contract) = $2)
        ORDER BY block_number DESC, tx_index DESC LIMIT 500`,
      [scenarioId, lower],
    ),
    query<EventDbRow>(
      `SELECT tx_hash, log_index, block_number::text, block_time, contract_address, contract_kind, event_name, args
         FROM chain_events
        WHERE scenario_id = $1 AND event_name IN ('FundsReceived', 'Withdrawn')
          AND (lower(contract_address) = $2 OR lower(args->>'to') = $2 OR $2 = lower($3))
        ORDER BY block_number DESC, log_index DESC`,
      [scenarioId, lower, (await marketplaceAddress(scenarioId)) ?? ""],
    ),
    query<EventDbRow>(
      `SELECT tx_hash, log_index, block_number::text, block_time, contract_address, contract_kind, event_name, args
         FROM chain_events
        WHERE scenario_id = $1 AND contract_kind = 'nft' AND event_name = 'Transfer'
          AND (lower(args->>'from') = $2 OR lower(args->>'to') = $2)
        ORDER BY block_number DESC, log_index DESC`,
      [scenarioId, lower],
    ),
    query<EventDbRow>(
      `SELECT tx_hash, log_index, block_number::text, block_time, contract_address, contract_kind, event_name, args
         FROM chain_events WHERE scenario_id = $1 AND lower(contract_address) = $2
        ORDER BY block_number DESC, log_index DESC LIMIT 500`,
      [scenarioId, lower],
    ),
    marketplaceAddress(scenarioId),
  ]);

  const internal = moneyEvents
    .map((e) => internalFromEvent(e, marketplace))
    .filter(
      (t): t is InternalTransfer => t !== null && (t.from.toLowerCase() === lower || t.to.toLowerCase() === lower),
    );

  return {
    txs: txRows.map(toTxRow),
    internal,
    nftTransfers: nftEvents.map((e) => ({
      txHash: e.tx_hash,
      blockNumber: Number(e.block_number),
      blockTime: e.block_time.toISOString(),
      from: e.args.from,
      to: e.args.to,
      tokenId: e.args.tokenId,
    })),
    emittedEvents: emitted.map((e) => ({
      txHash: e.tx_hash,
      blockNumber: Number(e.block_number),
      eventName: e.event_name,
      args: e.args,
    })),
  };
}

export type DecodedEvent = { logIndex: number; contract: string; eventName: string; args: Record<string, string> };

export type TxDetail = {
  hash: string;
  status: "pending" | "success" | "reverted";
  blockNumber: number | null;
  blockTime: string | null;
  from: string;
  to: string | null;
  valueWei: string;
  gasUsed: string | null;
  method: string;
  createdContract: string | null;
  events: DecodedEvent[];
  internal: InternalTransfer[];
  indexed: boolean;
};

function decodeLog(log: Log, kinds: Map<string, ContractKind>): DecodedEvent | null {
  const kind = kinds.get(log.address.toLowerCase());
  if (!kind) return null;
  const parsed = INTERFACES[kind].parseLog(log);
  if (!parsed) return null;
  const args = Object.fromEntries(
    parsed.fragment.inputs.map((input, i) => {
      const value = parsed.args[i];
      return [input.name, typeof value === "bigint" ? value.toString() : String(value)];
    }),
  );
  return { logIndex: log.index, contract: log.address, eventName: parsed.name, args };
}

// Reads one transaction live from the chain, decoding events from scenario contracts.
export async function txDetail(scenarioId: number, hash: string): Promise<TxDetail | null> {
  const provider = await getProvider();
  const tx = await provider.getTransaction(hash);
  if (!tx) return null;
  const [receipt, kinds, indexedRow, marketplace] = await Promise.all([
    provider.getTransactionReceipt(hash),
    contractKinds(scenarioId),
    queryOne<{ method: string }>("SELECT method FROM chain_txs WHERE scenario_id = $1 AND hash = $2", [
      scenarioId,
      hash,
    ]),
    marketplaceAddress(scenarioId),
  ]);
  const block = receipt ? await provider.getBlock(receipt.blockNumber) : null;
  const events = (receipt?.logs ?? []).map((l) => decodeLog(l, kinds)).filter((e): e is DecodedEvent => e !== null);
  const blockTime = block ? new Date(block.timestamp * 1000) : null;

  const internal = events
    .map((e) =>
      internalFromEvent(
        {
          tx_hash: hash,
          log_index: e.logIndex,
          block_number: String(receipt!.blockNumber),
          block_time: blockTime!,
          contract_address: e.contract,
          contract_kind: kinds.get(e.contract.toLowerCase())!,
          event_name: e.eventName,
          args: e.args,
        },
        marketplace,
      ),
    )
    .filter((t): t is InternalTransfer => t !== null);

  return {
    hash: tx.hash,
    status: !receipt ? "pending" : receipt.status === 1 ? "success" : "reverted",
    blockNumber: receipt?.blockNumber ?? null,
    blockTime: blockTime ? blockTime.toISOString() : null,
    from: tx.from,
    to: tx.to,
    valueWei: tx.value.toString(),
    gasUsed: receipt ? receipt.gasUsed.toString() : null,
    method: indexedRow?.method ?? decodeMethod(tx.to ? kinds.get(tx.to.toLowerCase()) : undefined, tx),
    createdContract: receipt?.contractAddress ?? null,
    events,
    internal,
    indexed: indexedRow !== null,
  };
}

export async function liveBalance(address: string): Promise<string | null> {
  try {
    return (await (await getProvider()).getBalance(getAddress(address))).toString();
  } catch {
    return null;
  }
}
