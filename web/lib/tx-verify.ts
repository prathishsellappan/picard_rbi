import "server-only";
import type { JsonRpcProvider, TransactionResponse } from "ethers";
import { sameAddress } from "./address";
import { getProvider } from "./chain";
import { query, queryOne } from "./db";
import type { ParticipantRole, ParticipantUser } from "./roles";

// What a participant may report, and which role may report it.
// Contract kinds (create_project, mint, withdraw) are added with the Stage 5 workflows.
// Display labels live in tx-labels.ts (client-safe).
export const TX_KINDS = {
  transfer: { role: "creator" },
  mule_transfer: { role: "mule" },
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

// Rules a transaction must satisfy before the app records it for this participant.
// Exported for unit tests.
export function checkTxRules(
  tx: Pick<TransactionResponse, "from" | "to" | "data" | "value">,
  kind: TxKind,
  user: ParticipantUser,
  scenario: { exchange2Address: string | null },
): void {
  if (TX_KINDS[kind].role !== user.role) {
    throw new TxVerificationError("This transaction type is not available for your role.", 403);
  }
  if (!sameAddress(tx.from, user.walletAddress)) {
    throw new TxVerificationError("This transaction was not sent from your assigned wallet.", 403);
  }
  // Both current kinds are plain ETH transfers to an address.
  if (!tx.to || tx.data !== "0x" || tx.value <= 0n) {
    throw new TxVerificationError("Expected a plain ETH transfer.");
  }
  if (kind === "mule_transfer") {
    if (!scenario.exchange2Address) throw new TxVerificationError("Exchange 2 is not configured.");
    if (!sameAddress(tx.to, scenario.exchange2Address)) {
      throw new TxVerificationError("This transfer was not sent to Exchange 2.");
    }
  }
}

async function readStatus(provider: JsonRpcProvider, hash: string) {
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) return { status: "pending" as const, blockNumber: null };
  return {
    status: receipt.status === 1 ? ("confirmed" as const) : ("failed" as const),
    blockNumber: receipt.blockNumber,
  };
}

// Looks the transaction up on-chain, checks it belongs to this participant, and records the
// chain's answer. Safe to call repeatedly to refresh a pending transaction's status.
export async function verifyAndRecordTx(user: ParticipantUser, kind: TxKind, txHash: string): Promise<VerifiedTx> {
  const provider = await getProvider();
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    throw new TxVerificationError("Transaction not found on the network yet. Try again in a few seconds.", 404);
  }

  const scenario = await queryOne<{ exchange2_address: string | null }>(
    "SELECT exchange2_address FROM scenarios WHERE id = $1",
    [user.scenarioId],
  );
  checkTxRules(tx, kind, user, { exchange2Address: scenario?.exchange2_address ?? null });

  const { status, blockNumber } = await readStatus(provider, txHash);
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
