import { Instructions } from "@/components/Instructions";
import { IndexerStatusLine } from "@/components/explorer/IndexerStatusLine";
import { AddressLink, TxLink } from "@/components/explorer/links";
import { Card, PageTitle } from "@/components/ui";
import { TransferSection } from "@/components/wallet/TransferSection";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { requireParticipant } from "@/lib/auth";
import { getOwnInstructions } from "@/lib/data/participant";
import { getActiveScenario } from "@/lib/data/scenario";
import { formatEth } from "@/lib/eth";
import { addressHistory, getIndexerStatus, getLabels } from "@/lib/explorer";
import { listOwnTxs } from "@/lib/tx-verify";

export default async function MulePage() {
  const user = await requireParticipant("mule");
  const [instructions, scenario, txs, history, labels, indexer] = await Promise.all([
    getOwnInstructions(user),
    getActiveScenario(),
    listOwnTxs(user),
    addressHistory(user.scenarioId, user.walletAddress),
    getLabels(user.scenarioId),
    getIndexerStatus(user.scenarioId),
  ]);
  const incoming = history.txs.filter(
    (t) => t.to?.toLowerCase() === user.walletAddress.toLowerCase() && t.status === 1 && t.valueWei !== "0",
  );

  return (
    <WalletProvider assignedWallet={user.walletAddress}>
      <PageTitle title="Dashboard" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <WalletPanel />
        <Instructions text={instructions} />

        <Card title="Incoming transfers">
          {incoming.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No incoming transfers indexed yet.</p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {incoming.map((t) => (
                <li key={t.hash} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {formatEth(t.valueWei)} ETH from <AddressLink address={t.from} labels={labels} />
                  </span>
                  <span className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                    block {t.blockNumber} <TxLink hash={t.hash} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2">
            <IndexerStatusLine status={indexer} />
          </div>
        </Card>

        {scenario?.exchange2Address ? (
          <TransferSection
            title={`Transfer to ${scenario.exchange2Label}`}
            kind="mule_transfer"
            rows={txs}
            fixedRecipient={{ address: scenario.exchange2Address, label: scenario.exchange2Label }}
          />
        ) : (
          <Card title="Final transfer">
            <p className="text-[13px] text-amber">The destination wallet is not configured yet. Ask the organizer.</p>
          </Card>
        )}
      </div>
    </WalletProvider>
  );
}
