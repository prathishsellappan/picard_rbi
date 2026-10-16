import "server-only";
import {
  Contract,
  Interface,
  ZeroAddress,
  type JsonRpcProvider,
  type TransactionReceipt,
  type TransactionResponse,
} from "ethers";
import { ABI } from "./abi";
import { sameAddress } from "./address";
import { getProvider } from "./chain";
import { ContractsNotReadyError, getScenarioContracts, type ScenarioContracts } from "./contracts";
import { query, queryOne } from "./db";
import type { ParticipantRole, ParticipantUser } from "./roles";

// What a participant may report, which role may report it, and what the transaction must be.
// Display labels live in tx-labels.ts (client-safe).
export const TX_KINDS = {
  transfer: { role: "creator" },
  mule_transfer: { role: "mule" },
  create_project: { role: "creator" },
  withdraw: { role: "creator" },
  mint: { role: "investor" },
} as const satisfies Record<string, { role: ParticipantRole }>;

export type TxKind = keyof typeof TX_KINDS;
export type TxRecordStatus = "pending" | "confirmed" | "failed";

export class TxVerificationError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

export type VerifiedTx = {
  txHash: string;
  kind: TxKind;
  status: TxRecordStatus;
  to: string | null;
  valueWei: string;
  blockNumber: number | null;
};

// Extra data some kinds carry. Only off-chain display data; never trusted for on-chain facts.
export type TxMeta = { description?: string };

export type TxContext = {
  exchange2Address: string | null;
  contracts: ScenarioContracts | null;
  creatorProject: string | null; // the reporting creator's project, from the factory
};

const factoryIface = new Interface(ABI.ProjectFactory);
const projectIface = new Interface(ABI.Project);
const marketplaceIface = new Interface(ABI.Marketplace);

function calledFunction(iface: Interface, tx: Pick<TransactionResponse, "data" | "value">): string | null {
  try {
    return iface.parseTransaction({ data: tx.data, value: tx.value })?.name ?? null;
  } catch {
    return null;
  }
}

function expectCall(
  tx: Pick<TransactionResponse, "to" | "data" | "value">,
  target: string | null | undefined,
  iface: Interface,
  fn: string,
  what: string,
) {
  if (!target) throw new TxVerificationError(`${what} is not available yet.`);
  if (!tx.to || !sameAddress(tx.to, target) || calledFunction(iface, tx) !== fn) {
    throw new TxVerificationError(`Expected a ${fn}() call to ${what}.`);
  }
}

// Rules a transaction must satisfy before the app records it for this participant.
// Exported for unit tests.
export function checkTxRules(
  tx: Pick<TransactionResponse, "from" | "to" | "data" | "value">,
  kind: TxKind,
  user: ParticipantUser,
  ctx: TxContext,
): void {
  if (TX_KINDS[kind].role !== user.role) {
    throw new TxVerificationError("This transaction type is not available for your role.", 403);
  }
  if (!sameAddress(tx.from, user.walletAddress)) {
    throw new TxVerificationError("This transaction was not sent from your assigned wallet.", 403);
  }

  switch (kind) {
    case "transfer":
    case "mule_transfer":
      if (!tx.to || tx.data !== "0x" || tx.value <= 0n) throw new TxVerificationError("Expected a plain ETH transfer.");
      if (kind === "mule_transfer") {
        if (!ctx.exchange2Address) throw new TxVerificationError("Exchange 2 is not configured.");
        if (!sameAddress(tx.to, ctx.exchange2Address)) {
          throw new TxVerificationError("This transfer was not sent to Exchange 2.");
        }
      }
      return;
    case "create_project":
      return expectCall(tx, ctx.contracts?.factory, factoryIface, "createProject", "the project factory");
    case "mint":
      return expectCall(tx, ctx.contracts?.marketplace, marketplaceIface, "mint", "the marketplace");
    case "withdraw":
      return expectCall(tx, ctx.creatorProject, projectIface, "withdraw", "your project");
  }
}

async function buildContext(user: ParticipantUser, kind: TxKind, provider: JsonRpcProvider): Promise<TxContext> {
  const scenario = await queryOne<{ exchange2_address: string | null }>(
    "SELECT exchange2_address FROM scenarios WHERE id = $1",
    [user.scenarioId],
  );
  const ctx: TxContext = {
    exchange2Address: scenario?.exchange2_address ?? null,
    contracts: null,
    creatorProject: null,
  };
  if (kind === "transfer" || kind === "mule_transfer") return ctx;

  try {
    ctx.contracts = await getScenarioContracts(user.scenarioId);
  } catch (error) {
    if (error instanceof ContractsNotReadyError) throw new TxVerificationError(error.message);
    throw error;
  }
  if (kind === "withdraw") {
    const factory = new Contract(ctx.contracts.factory, ABI.ProjectFactory, provider);
    const project = (await factory.projectOfCreator(user.walletAddress)) as string;
    ctx.creatorProject = project === ZeroAddress ? null : project;
  }
  return ctx;
}

// After a confirmed createProject, store the project's off-chain description next to the
// on-chain facts taken from the ProjectCreated event.
async function recordCreatedProject(user: ParticipantUser, ctx: TxContext, receipt: TransactionReceipt, meta: TxMeta) {
  const log = receipt.logs.find((l) => sameAddress(l.address, ctx.contracts!.factory));
  const event = log ? factoryIface.parseLog(log) : null;
  if (!event || event.name !== "ProjectCreated" || !sameAddress(event.args.creator, user.walletAddress)) {
    throw new TxVerificationError("No ProjectCreated event for your wallet in this transaction.");
  }
  await query(
    `INSERT INTO projects (scenario_id, creator_id, name, description, mint_price_wei, contract_address, onchain_id,
                           creation_tx_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
     ON CONFLICT (scenario_id, creator_id) DO UPDATE SET
       name = EXCLUDED.name, mint_price_wei = EXCLUDED.mint_price_wei, contract_address = EXCLUDED.contract_address,
       onchain_id = EXCLUDED.onchain_id, creation_tx_hash = EXCLUDED.creation_tx_hash, status = 'confirmed',
       description = CASE WHEN EXCLUDED.description <> '' THEN EXCLUDED.description ELSE projects.description END`,
    [
      user.scenarioId,
      user.participantId,
      event.args.name as string,
      (meta.description ?? "").slice(0, 1000),
      (event.args.mintPrice as bigint).toString(),
      event.args.project as string,
      Number(event.args.projectId as bigint),
      receipt.hash,
    ],
  );
}

// Looks the transaction up on-chain, checks it belongs to this participant, and records the
// chain's answer. Safe to call repeatedly to refresh a pending transaction's status.
export async function verifyAndRecordTx(
  user: ParticipantUser,
  kind: TxKind,
  txHash: string,
  meta: TxMeta = {},
): Promise<VerifiedTx> {
  const provider = await getProvider();
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    throw new TxVerificationError("Transaction not found on the network yet. Try again in a few seconds.", 404);
  }

  const ctx = await buildContext(user, kind, provider);
  checkTxRules(tx, kind, user, ctx);

  const receipt = await provider.getTransactionReceipt(txHash);
  const status: TxRecordStatus = !receipt ? "pending" : receipt.status === 1 ? "confirmed" : "failed";
  const blockNumber = receipt?.blockNumber ?? null;

  const rows = await query<{ participant_id: string }>(
    `INSERT INTO tx_requests (scenario_id, participant_id, kind, tx_hash, status, to_address, value_wei, block_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (scenario_id, tx_hash) WHERE tx_hash IS NOT NULL
     DO UPDATE SET status = EXCLUDED.status, block_number = EXCLUDED.block_number, updated_at = now()
     RETURNING participant_id`,
    [user.scenarioId, user.participantId, kind, tx.hash, status, tx.to, tx.value.toString(), blockNumber],
  );
  if (rows[0]?.participant_id !== user.participantId) {
    throw new TxVerificationError("This transaction is recorded for another participant.", 403);
  }

  if (kind === "create_project" && status === "confirmed" && receipt) {
    await recordCreatedProject(user, ctx, receipt, meta);
  }

  return { txHash: tx.hash, kind, status, to: tx.to, valueWei: tx.value.toString(), blockNumber };
}

export type OwnTxRow = {
  tx_hash: string;
  kind: TxKind;
  status: string;
  to_address: string | null;
  value_wei: string | null;
  block_number: string | null;
  created_at: string;
};

export async function listOwnTxs(user: ParticipantUser): Promise<OwnTxRow[]> {
  return query<OwnTxRow>(
    `SELECT tx_hash, kind, status, to_address, value_wei::text, block_number::text, created_at
       FROM tx_requests
      WHERE scenario_id = $1 AND participant_id = $2 AND tx_hash IS NOT NULL
      ORDER BY created_at DESC LIMIT 50`,
    [user.scenarioId, user.participantId],
  );
}
