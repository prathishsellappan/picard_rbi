import { AssignedWallet } from "@/components/AssignedWallet";
import { Instructions } from "@/components/Instructions";
import { Card, MockNotice, PageTitle, StatusBadge, buttonClass, inputClass } from "@/components/ui";
import { requireParticipant } from "@/lib/auth";
import { getOwnInstructions } from "@/lib/data/participant";
import { MOCK_TXS } from "@/lib/mock-chain";

export default async function CreatorPage() {
  const user = await requireParticipant("creator");
  const instructions = await getOwnInstructions(user);
  const myTxs = MOCK_TXS.filter((tx) => tx.fromLabel === user.participantId);

  return (
    <>
      <PageTitle title="Creator dashboard" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <AssignedWallet address={user.walletAddress} />
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

        <Card title="Send test ETH">
          <MockNotice>Sending arrives in Stage 5.</MockNotice>
          <fieldset disabled className="space-y-3 opacity-60">
            <input className={inputClass} placeholder="Recipient address (0x…)" />
            <input className={inputClass} placeholder="Amount (ETH)" />
            <button className={buttonClass}>Review transfer</button>
          </fieldset>
        </Card>

        <div className="md:col-span-2">
          <Card title="My transactions">
            <MockNotice />
            {myTxs.length === 0 ? (
              <p className="text-sm text-slate-500">No transactions yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {myTxs.map((tx) => (
                  <li key={tx.hash} className="flex items-center justify-between">
                    <span>
                      {tx.kind} → {tx.toLabel}
                    </span>
                    <StatusBadge status={tx.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
