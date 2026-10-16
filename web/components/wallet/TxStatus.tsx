"use client";

import { Mono, StatusBadge } from "@/components/ui";
import { explorerTxUrl, getConfiguredChain } from "@/lib/chains";
import type { TxState } from "./useTransaction";

export function TxStatus({ state, onRecheck }: { state: TxState; onRecheck: () => void }) {
  if (state.phase === "idle") return null;
  const url = state.hash ? explorerTxUrl(getConfiguredChain(), state.hash) : null;

  return (
    <div role="status" className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex items-center gap-2">
        <StatusBadge status={state.phase} />
        <span>{state.message}</span>
      </div>
      {state.hash && (
        <p className="mt-2">
          <span className="text-slate-500">Tx: </span>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline">
              <Mono>{state.hash}</Mono>
            </a>
          ) : (
            <Mono>{state.hash}</Mono>
          )}
        </p>
      )}
      {(state.phase === "pending" || state.phase === "timeout") && state.hash && (
        <button type="button" onClick={onRecheck} className="mt-2 text-xs underline">
          Check again
        </button>
      )}
    </div>
  );
}
