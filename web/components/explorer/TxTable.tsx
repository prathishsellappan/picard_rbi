import { formatEther } from "ethers";
import { StatusBadge } from "@/components/ui";
import type { Labels, TxRow } from "@/lib/explorer";
import { AddressLink, TxLink } from "./links";

export function txStatusLabel(status: number | null): string {
  return status === 1 ? "confirmed" : status === 0 ? "failed" : "pending";
}

export function TxTable({ txs, labels, empty = "No transactions." }: { txs: TxRow[]; labels: Labels; empty?: string }) {
  if (txs.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-3">Block</th>
            <th className="py-2 pr-3">Time (UTC)</th>
            <th className="py-2 pr-3">Tx</th>
            <th className="py-2 pr-3">Method</th>
            <th className="py-2 pr-3">From</th>
            <th className="py-2 pr-3">To</th>
            <th className="py-2 pr-3">Value</th>
            <th className="py-2 pr-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => (
            <tr key={tx.hash} className="border-t border-slate-100 align-top">
              <td className="py-2 pr-3">{tx.blockNumber}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-xs">{tx.blockTime.replace("T", " ").slice(0, 19)}</td>
              <td className="py-2 pr-3">
                <TxLink hash={tx.hash} />
              </td>
              <td className="py-2 pr-3 font-mono text-xs">{tx.method}</td>
              <td className="py-2 pr-3">
                <AddressLink address={tx.from} labels={labels} />
              </td>
              <td className="py-2 pr-3">
                <AddressLink address={tx.to ?? tx.createdContract} labels={labels} />
              </td>
              <td className="whitespace-nowrap py-2 pr-3">{formatEther(tx.valueWei)} ETH</td>
              <td className="py-2 pr-3">
                <StatusBadge status={txStatusLabel(tx.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
