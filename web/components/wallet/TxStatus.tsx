"use client";

import { linkClass, Mono, StatusBadge } from "@/components/ui";
import { explorerTxUrl, getConfiguredChain } from "@/lib/chains";
import type { TxState } from "./useTransaction";

export function TxStatus({ state, onRecheck }: { state: TxState; onRecheck: () => void }) {
  if (state.phase === "idle") return null;
  const url = state.hash ? explorerTxUrl(getConfiguredChain(), state.hash) : null;

  return (
    <div role="status" className="mt-3 rounded-[9px] border border-line-strong bg-paper-deep/60 p-3 text-[13px]">
      <div className="flex items-center gap-2">
        <StatusBadge status={state.phase} />
        <span>{state.message}</span>
      </div>
      {state.hash && (
        <p className="mt-2">
          <span className="text-ink-muted">Tx: </span>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className={linkClass}>
              <Mono>{state.hash}</Mono>
            </a>
          ) : (
            <Mono>{state.hash}</Mono>
          )}
        </p>
      )}
      {(state.phase === "pending" || state.phase === "timeout") && state.hash && (
        <button type="button" onClick={onRecheck} className={`mt-2 text-[11.5px] ${linkClass}`}>
          Check again
        </button>
      )}
    </div>
  );
}
