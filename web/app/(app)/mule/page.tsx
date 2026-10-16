import { Instructions } from "@/components/Instructions";
import { Card, MockNotice, PageTitle } from "@/components/ui";
import { TransferSection } from "@/components/wallet/TransferSection";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { requireParticipant } from "@/lib/auth";
import { getOwnInstructions } from "@/lib/data/participant";
import { getActiveScenario } from "@/lib/data/scenario";

export default async function MulePage() {
  const user = await requireParticipant("mule");
  const [instructions, scenario] = await Promise.all([getOwnInstructions(user), getActiveScenario()]);

  return (
    <WalletProvider assignedWallet={user.walletAddress}>
      <PageTitle title="Dashboard" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <WalletPanel />
        <Instructions text={instructions} />

        <Card title="Incoming transfers">
          <MockNotice>Incoming transfers are listed once the indexer arrives in Stage 6.</MockNotice>
          <p className="text-sm text-slate-500">Your current balance is shown in the wallet panel.</p>
        </Card>

        {scenario?.exchange2Address ? (
          <TransferSection
            title="Transfer to Exchange 2"
            kind="mule_transfer"
            fixedRecipient={{ address: scenario.exchange2Address, label: "Exchange 2" }}
          />
        ) : (
          <Card title="Transfer to Exchange 2">
            <p className="text-sm text-red-700">Exchange 2 is not configured yet. Ask the organizer.</p>
          </Card>
        )}
      </div>
    </WalletProvider>
  );
}
