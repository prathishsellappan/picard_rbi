import { redirect } from "next/navigation";
import { IndexerStatusLine } from "@/components/explorer/IndexerStatusLine";
import { AddressLink } from "@/components/explorer/links";
import { TxTable } from "@/components/explorer/TxTable";
import { Card, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveScenario } from "@/lib/data/scenario";
import { getIndexerStatus, getLabels, recentTxs } from "@/lib/explorer";

function searchTarget(q: string): string | null {
  const value = q.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return `/explorer/tx/${value.toLowerCase()}`;
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return `/explorer/address/${value}`;
  return null;
}

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;
  let searchError: string | null = null;
  if (q) {
    const target = searchTarget(q);
    if (target) redirect(target);
    searchError = "Enter a full wallet/contract address (0x + 40 hex characters) or transaction hash (0x + 64).";
  }

  const scenario = await getActiveScenario();
  if (!scenario) return <PageTitle title="Explorer" subtitle="No active scenario." />;
  const [labels, txs, status] = await Promise.all([
    getLabels(scenario.id),
    recentTxs(scenario.id, 50),
    getIndexerStatus(scenario.id),
  ]);
  const directory = [...labels.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));

  return (
    <>
      <PageTitle title="Explorer" subtitle="Scenario wallets, contracts, transactions, and NFT events" />
      <form action="/explorer" method="get" className="mb-2 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          className={`${inputClass} font-mono`}
          placeholder="Search address or transaction hash"
          aria-label="Search"
        />
        <button type="submit" className={buttonClass}>
          Search
        </button>
      </form>
      {searchError && <p className="mb-2 text-sm text-red-700">{searchError}</p>}
      <IndexerStatusLine status={status} />

      <div className="mt-6 grid gap-4">
        <Card title="Scenario addresses">
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {directory.map(([address]) => (
              <li key={address}>
                <AddressLink address={address} labels={labels} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Latest scenario transactions">
          <TxTable txs={txs} labels={labels} empty="Nothing indexed yet." />
        </Card>
      </div>
    </>
  );
}
