"use client";

import type { JsonRpcSigner, TransactionResponse } from "ethers";
import { useCallback, useState } from "react";
import { getConfiguredChain } from "@/lib/chains";
import { classifyTxError } from "@/lib/wallet/tx-errors";
import type { TxKind } from "@/lib/tx-verify";
import { useWallet } from "./WalletProvider";

export type TxPhase =
  | "idle"
  | "requested" // waiting for the participant to approve in MetaMask
  | "pending" // broadcast, waiting to be mined
  | "confirmed" // server checked the receipt on-chain: success
  | "failed" // mined but reverted
  | "rejected" // participant declined in MetaMask
  | "timeout" // no receipt within the wait window; may still confirm
  | "error";

export type TxState = { phase: TxPhase; hash: string | null; message: string | null };

const IDLE: TxState = { phase: "idle", hash: null, message: null };
const WAIT_TIMEOUT_MS = getConfiguredChain().id === 31337 ? 30_000 : 180_000;

type ServerTx = { status: "pending" | "confirmed" | "failed" };

// Asks the server to look the transaction up on-chain and record it. Retries briefly because
// the server's RPC node can lag behind MetaMask's right after broadcast.
async function reportToServer(kind: TxKind, txHash: string): Promise<ServerTx> {
  let lastError = "Could not record the transaction.";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch("/api/tx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, txHash }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body as ServerTx;
    lastError = body.error ?? lastError;
    if (res.status !== 404) break;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(lastError);
}

export function useTransaction(kind: TxKind, onSettled?: () => void) {
  const { getVerifiedSigner } = useWallet();
  const [state, setState] = useState<TxState>(IDLE);

  const settle = useCallback(
    async (hash: string) => {
      const server = await reportToServer(kind, hash);
      if (server.status === "confirmed") {
        setState({ phase: "confirmed", hash, message: "Confirmed on-chain." });
      } else if (server.status === "failed") {
        setState({ phase: "failed", hash, message: "The transaction failed on-chain (reverted)." });
      } else {
        setState({ phase: "pending", hash, message: "Waiting for the network to confirm…" });
      }
      onSettled?.();
    },
    [kind, onSettled],
  );

  const run = useCallback(
    async (send: (signer: JsonRpcSigner) => Promise<TransactionResponse>) => {
      let hash: string | null = null;
      try {
        setState({ phase: "requested", hash: null, message: "Approve the transaction in MetaMask…" });
        const signer = await getVerifiedSigner();
        const tx = await send(signer);
        hash = tx.hash;
        setState({ phase: "pending", hash, message: "Submitted. Waiting for confirmation…" });
        await reportToServer(kind, hash).catch(() => {}); // early record; re-checked below
        await tx.wait(1, WAIT_TIMEOUT_MS);
        await settle(hash);
      } catch (error) {
        const { kind: failure, message } = classifyTxError(error);
        // A reverted receipt is still a real on-chain record; let the server record it too.
        if (failure === "failed" && hash) await settle(hash).catch(() => {});
        else setState({ phase: failure, hash, message });
      }
    },
    [getVerifiedSigner, kind, settle],
  );

  // For pending/timeout: ask the server to check the chain again.
  const recheck = useCallback(async () => {
    if (!state.hash) return;
    try {
      await settle(state.hash);
    } catch (error) {
      setState((s) => ({ ...s, message: (error as Error).message }));
    }
  }, [settle, state.hash]);

  const reset = useCallback(() => setState(IDLE), []);

  return { state, run, recheck, reset, busy: state.phase === "requested" || state.phase === "pending" };
}
