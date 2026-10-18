import { formatEther } from "ethers";
import { notFound } from "next/navigation";
import { AddressLink, PublicExplorerLink } from "@/components/explorer/links";
import { Card, Mono, PageTitle, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveScenario } from "@/lib/data/scenario";
import { getLabels, txDetail } from "@/lib/explorer";
import { formatIST } from "@/lib/time";

const STATUS_BADGE = { success: "confirmed", reverted: "failed", pending: "pending" } as const;

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  await requireUser();
  const { hash } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) notFound();
  const scenario = await getActiveScenario();
  if (!scenario) notFound();
  const [labels, tx] = await Promise.all([getLabels(scenario.id), txDetail(scenario.id, hash)]);

  if (!tx) {
    return (
      <>
        <PageTitle title="Transaction not found" />
        <Card title="Not on this chain">
          <p className="text-[13px] text-ink-soft">
            The configured network has no transaction with hash <Mono>{hash}</Mono>.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Transaction" subtitle="Read live from the chain" />
      <Card title="Details">
        <dl className="grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[10rem_1fr]">
          <dt className="text-ink-muted">Hash</dt>
          <dd>
            <Mono>{tx.hash}</Mono>
          </dd>
          <dt className="text-ink-muted">Status</dt>
          <dd>
            <StatusBadge status={STATUS_BADGE[tx.status]} />
          </dd>
          <dt className="text-ink-muted">Block</dt>
          <dd>{tx.blockNumber ?? "pending"}</dd>
          <dt className="text-ink-muted">Timestamp (IST)</dt>
          <dd>{formatIST(tx.blockTime)}</dd>
          <dt className="text-ink-muted">From</dt>
          <dd>
            <AddressLink address={tx.from} labels={labels} />
          </dd>
          <dt className="text-ink-muted">To</dt>
          <dd>
            {tx.to ? (
              <AddressLink address={tx.to} labels={labels} />
            ) : (
              <span>
                Contract creation → <AddressLink address={tx.createdContract} labels={labels} />
              </span>
            )}
          </dd>
          <dt className="text-ink-muted">Value</dt>
          <dd>{formatEther(tx.valueWei)} ETH</dd>
          <dt className="text-ink-muted">Method</dt>
          <dd className="font-mono text-[11.5px]">{tx.method}</dd>
          <dt className="text-ink-muted">Gas used</dt>
          <dd>{tx.gasUsed ?? "—"}</dd>
          <dt className="text-ink-muted">In scenario index</dt>
          <dd>{tx.indexed ? "yes" : "no (not yet indexed, or not a scenario transaction)"}</dd>
        </dl>
        <div className="mt-3">
          <PublicExplorerLink kind="tx" value={tx.hash} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4">
        {tx.internal.length > 0 && (
          <Card title="Internal ETH movements">
            <ul className="text-[13px]">
              {tx.internal.map((t, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 py-1">
                  <AddressLink address={t.from} labels={labels} /> → <AddressLink address={t.to} labels={labels} />
                  <span>{formatEther(t.valueWei)} ETH</span>
                  <span className="text-ink-muted">({t.reason})</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title={`Scenario contract events (${tx.events.length})`}>
          {tx.events.length === 0 ? (
            <p className="text-[13px] text-ink-muted">None.</p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {tx.events.map((e) => (
                <li key={e.logIndex} className="py-2">
                  <p>
                    <span className="font-medium">{e.eventName}</span> <span className="text-ink-muted">from</span>{" "}
                    <AddressLink address={e.contract} labels={labels} />
                  </p>
                  <dl className="mt-1 grid gap-x-3 text-[11.5px] sm:grid-cols-[10rem_1fr]">
                    {Object.entries(e.args).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-ink-muted">{key}</dt>
                        <dd className="break-all font-mono">
                          {/^0x[0-9a-fA-F]{40}$/.test(value) ? <AddressLink address={value} labels={labels} /> : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
