import { Card, MockNotice, PageTitle, StatusBadge, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MOCK_TXS } from "@/lib/mock-chain";

export default async function ExplorerPage() {
  await requireUser();

  return (
    <>
      <PageTitle title="Explorer" subtitle="Scenario wallets, transactions, and NFT events" />
      <MockNotice>The indexer and real search arrive in Stage 6.</MockNotice>
      <input disabled className={`${inputClass} mb-4 opacity-60`} placeholder="Search address or transaction hash" />
      <Card title="Recent scenario transactions">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Block</th>
                <th className="py-2 pr-3">Tx</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Value</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TXS.map((tx) => (
                <tr key={tx.hash} className="border-t border-slate-100">
                  <td className="py-2 pr-3">{tx.blockNumber}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{tx.hash}</td>
                  <td className="py-2 pr-3">{tx.fromLabel}</td>
                  <td className="py-2 pr-3">{tx.toLabel}</td>
                  <td className="py-2 pr-3">{tx.valueEth} ETH</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={tx.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
