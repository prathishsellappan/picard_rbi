"use client";

import { formatEther } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { Mono, StatusBadge } from "@/components/ui";
import { explorerTxUrl, getConfiguredChain } from "@/lib/chains";
import { shortAddress } from "@/lib/address";
import type { OwnTxRow } from "@/lib/tx-verify";
import { TX_LABELS } from "@/lib/tx-labels";

// Application records of this participant's reported transactions. Each status was read from
// the chain by the server when it was last checked.
export function useMyTransactions() {
  const [rows, setRows] = useState<OwnTxRow[] | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/tx");
    if (res.ok) setRows(await res.json());
  }, []);
  useEffect(() => {
    // Fetch once on mount; reload() is also called after each transaction settles.
    fetch("/api/tx")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setRows(data))
      .catch(() => {});
  }, []);
  return { rows, reload };
}

export function MyTransactionsList({ rows }: { rows: OwnTxRow[] | null }) {
  const chain = getConfiguredChain();
  if (rows === null) return <p className="text-sm text-slate-500">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-slate-500">No transactions yet.</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {rows.map((row) => {
        const url = explorerTxUrl(chain, row.tx_hash);
        return (
          <li key={row.tx_hash} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              {TX_LABELS[row.kind] ?? row.kind}
              {row.value_wei && ` · ${formatEther(row.value_wei)} ETH`}
              {row.to_address && ` → ${shortAddress(row.to_address)}`}
            </span>
            <span className="flex items-center gap-2">
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="underline">
                  <Mono>{shortAddress(row.tx_hash)}</Mono>
                </a>
              ) : (
                <Mono>{shortAddress(row.tx_hash)}</Mono>
              )}
              <StatusBadge status={row.status} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
