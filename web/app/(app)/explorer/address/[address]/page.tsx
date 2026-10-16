import { formatEther, getAddress, isAddress } from "ethers";
import { notFound } from "next/navigation";
import { IndexerStatusLine } from "@/components/explorer/IndexerStatusLine";
import { AddressLink, PublicExplorerLink, TxLink } from "@/components/explorer/links";
import { TxTable } from "@/components/explorer/TxTable";
import { Card, Mono, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveScenario } from "@/lib/data/scenario";
import { addressHistory, getIndexerStatus, getLabels, liveBalance } from "@/lib/explorer";

export default async function AddressPage({ params }: { params: Promise<{ address: string }> }) {
  await requireUser();
  const { address: raw } = await params;
  if (!isAddress(raw.toLowerCase())) notFound();
  const address = getAddress(raw.toLowerCase());

  const scenario = await getActiveScenario();
  if (!scenario) notFound();
  const [labels, history, balance, status] = await Promise.all([
    getLabels(scenario.id),
    addressHistory(scenario.id, address),
    liveBalance(address),
    getIndexerStatus(scenario.id),
  ]);
  const label = labels.get(address.toLowerCase());
  const lower = address.toLowerCase();
  const incoming = history.txs.filter((t) => t.to?.toLowerCase() === lower);
  const outgoing = history.txs.filter((t) => t.from.toLowerCase() === lower);
  const other = history.txs.filter((t) => t.to?.toLowerCase() !== lower && t.from.toLowerCase() !== lower);

  return (
    <>
      <PageTitle title={label ?? "Address"} subtitle={label ? undefined : "Not a known scenario address"} />
      <Card title="Overview">
        <Mono>{address}</Mono>
        <p className="mt-2 text-sm">
          <span className="text-slate-500">Current balance (live): </span>
          {balance !== null ? `${formatEther(balance)} ETH` : "unavailable"}
        </p>
        <div className="mt-2">
          <PublicExplorerLink kind="address" value={address} />
        </div>
      </Card>
      <div className="mt-2">
        <IndexerStatusLine status={status} />
      </div>

      <div className="mt-4 grid gap-4">
        <Card title={`Incoming transactions (${incoming.length})`}>
          <TxTable txs={incoming} labels={labels} />
        </Card>
        <Card title={`Outgoing transactions (${outgoing.length})`}>
          <TxTable txs={outgoing} labels={labels} />
        </Card>
        {other.length > 0 && (
          <Card title="Contract creation">
            <TxTable txs={other} labels={labels} />
          </Card>
        )}
        <Card title={`Internal ETH movements (${history.internal.length})`}>
          <p className="mb-2 text-xs text-slate-500">
            ETH moved by contracts inside other transactions. These don&apos;t appear as transactions; they are
            reconstructed from the contracts&apos; FundsReceived and Withdrawn events.
          </p>
          {history.internal.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.internal.map((t) => (
                <li key={`${t.txHash}-${t.from}-${t.to}`} className="flex flex-wrap items-center gap-x-2 py-2">
                  <span className="text-slate-500">#{t.blockNumber}</span>
                  <AddressLink address={t.from} labels={labels} /> → <AddressLink address={t.to} labels={labels} />
                  <span>{formatEther(t.valueWei)} ETH</span>
                  <span className="text-slate-500">({t.reason})</span>
                  <TxLink hash={t.txHash} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`NFT transfers (${history.nftTransfers.length})`}>
          {history.nftTransfers.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.nftTransfers.map((t) => (
                <li key={`${t.txHash}-${t.tokenId}`} className="flex flex-wrap items-center gap-x-2 py-2">
                  <span>Token #{t.tokenId}</span>
                  {t.from === "0x0000000000000000000000000000000000000000" ? (
                    <span className="text-slate-500">minted to</span>
                  ) : (
                    <>
                      <AddressLink address={t.from} labels={labels} /> →
                    </>
                  )}
                  <AddressLink address={t.to} labels={labels} />
                  <TxLink hash={t.txHash} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        {history.emittedEvents.length > 0 && (
          <Card title={`Events emitted by this contract (${history.emittedEvents.length})`}>
            <ul className="divide-y divide-slate-100 text-sm">
              {history.emittedEvents.map((e, i) => (
                <li key={`${e.txHash}-${i}`} className="py-2">
                  <span className="font-medium">{e.eventName}</span> <TxLink hash={e.txHash} />
                  <span className="ml-2 break-all font-mono text-xs text-slate-600">{JSON.stringify(e.args)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
