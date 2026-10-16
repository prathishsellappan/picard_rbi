// Classifies errors thrown while sending a transaction or waiting for it.
// Pure, so the rules are unit-tested.

export type TxFailureKind = "rejected" | "failed" | "timeout" | "error";

type ErrorLike = {
  code?: unknown;
  shortMessage?: unknown;
  message?: unknown;
  info?: unknown;
  error?: unknown;
  receipt?: unknown;
  revert?: { name?: unknown } | null;
};

// Plain-language messages for the contracts' custom errors.
const REVERT_MESSAGES: Record<string, string> = {
  CreatorNotAllowed: "Your wallet is not approved to create a project yet. Ask the organizer.",
  CreatorAlreadyHasProject: "You already have a project. Each creator can create one.",
  MintPriceOutOfBounds: "The mint price is outside the organizer's allowed range.",
  InvalidName: "The project name must be 1–64 characters.",
  MarketplaceNotSet: "The marketplace is not set up yet. Ask the organizer.",
  IncorrectPayment: "The payment doesn't match the project's mint price.",
  UnknownProject: "That project isn't registered in the marketplace.",
  NotCreator: "Only the project's creator can withdraw.",
  InvalidAmount: "The amount must be more than 0 and no more than the available funds.",
  TransferFailed: "The withdrawal transfer failed.",
};

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
  if (code === "CALL_EXCEPTION") {
    const revertName = typeof e.revert?.name === "string" ? e.revert.name : null;
    const reason = (revertName && REVERT_MESSAGES[revertName]) ?? revertName;
    // With a receipt, the transaction was mined and reverted. Without one, it was rejected
    // during gas estimation and never sent.
    if (e.receipt) {
      return { kind: "failed", message: `The transaction failed on-chain${reason ? `: ${reason}` : " (reverted)."}` };
    }
    return { kind: "error", message: `Not sent — the transaction would fail${reason ? `: ${reason}` : "."}` };
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
