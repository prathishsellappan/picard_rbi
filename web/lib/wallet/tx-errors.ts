// Classifies errors thrown while sending a transaction or waiting for it.
// Pure, so the rules are unit-tested.

export type TxFailureKind = "rejected" | "failed" | "timeout" | "error";

type ErrorLike = { code?: unknown; shortMessage?: unknown; message?: unknown; info?: unknown; error?: unknown };

function codeOf(error: unknown): unknown {
  return (error as ErrorLike | null)?.code;
}

export function classifyTxError(error: unknown): { kind: TxFailureKind; message: string } {
  const e = (error ?? {}) as ErrorLike;
  const code = codeOf(error);
  const nestedCode = codeOf(e.error) ?? codeOf((e.info as ErrorLike | undefined)?.error);

  // ethers wraps EIP-1193 code 4001 as ACTION_REJECTED.
  if (code === "ACTION_REJECTED" || code === 4001 || nestedCode === 4001) {
    return { kind: "rejected", message: "You rejected the transaction in MetaMask." };
  }
  // tx.wait() throws CALL_EXCEPTION when the mined receipt has status 0.
  if (code === "CALL_EXCEPTION") {
    return { kind: "failed", message: "The transaction failed on-chain (reverted)." };
  }
  if (code === "TIMEOUT") {
    return { kind: "timeout", message: "No confirmation yet. The transaction may still be pending." };
  }
  if (code === "INSUFFICIENT_FUNDS") {
    return { kind: "error", message: "Not enough test ETH for the amount plus gas." };
  }
  const message =
    typeof e.shortMessage === "string" ? e.shortMessage : typeof e.message === "string" ? e.message : "Unknown error";
  return { kind: "error", message };
}
