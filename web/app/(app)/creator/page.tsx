import { Instructions } from "@/components/Instructions";
import { Card, MockNotice, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { TransferSection } from "@/components/wallet/TransferSection";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { requireParticipant } from "@/lib/auth";
import { getOwnInstructions } from "@/lib/data/participant";

export default async function CreatorPage() {
  const user = await requireParticipant("creator");
  const instructions = await getOwnInstructions(user);

  return (
    <WalletProvider assignedWallet={user.walletAddress}>
      <PageTitle title="Creator dashboard" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <WalletPanel />
        <Instructions text={instructions} />

        <Card title="Create your project">
          <MockNotice>Project deployment arrives in Stage 5.</MockNotice>
          <fieldset disabled className="space-y-3 opacity-60">
            <input className={inputClass} placeholder="Project name" />
            <textarea className={inputClass} placeholder="Description" rows={3} />
            <input className={inputClass} placeholder="Mint price (ETH)" />
            <button className={buttonClass}>Deploy project</button>
          </fieldset>
        </Card>

        <TransferSection title="Send test ETH" kind="transfer" />
      </div>
    </WalletProvider>
  );
}
