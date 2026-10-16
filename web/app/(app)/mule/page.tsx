import { AssignedWallet } from "@/components/AssignedWallet";
import { Instructions } from "@/components/Instructions";
import { Card, MockNotice, Mono, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { requireParticipant } from "@/lib/auth";
import { getOwnInstructions } from "@/lib/data/participant";
import { getActiveScenario } from "@/lib/data/scenario";

export default async function MulePage() {
  const user = await requireParticipant("mule");
  const [instructions, scenario] = await Promise.all([getOwnInstructions(user), getActiveScenario()]);

  return (
    <>
      <PageTitle title="Dashboard" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <AssignedWallet address={user.walletAddress} />
        <Instructions text={instructions} />

        <Card title="Incoming transfers">
          <MockNotice>Real incoming transfers arrive with the indexer in Stage 6.</MockNotice>
          <p className="text-sm text-slate-500">No incoming transfers yet.</p>
        </Card>

        <Card title="Transfer to Exchange 2">
          <MockNotice>Sending arrives in Stage 5.</MockNotice>
          <p className="mb-2 text-sm text-slate-600">Destination (fixed by the organizer)</p>
          {scenario?.exchange2Address ? (
            <Mono>{scenario.exchange2Address}</Mono>
          ) : (
            <p className="text-sm text-red-700">Exchange 2 is not configured yet.</p>
          )}
          <fieldset disabled className="mt-3 space-y-3 opacity-60">
            <input className={inputClass} placeholder="Amount (ETH)" />
            <button className={buttonClass}>Send to Exchange 2</button>
          </fieldset>
        </Card>
      </div>
    </>
  );
}
