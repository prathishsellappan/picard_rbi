import { AssignedWallet } from "@/components/AssignedWallet";
import { Instructions } from "@/components/Instructions";
import { Card, MockNotice, PageTitle, buttonClass } from "@/components/ui";
import { requireParticipant } from "@/lib/auth";
import { getOwnInstructions } from "@/lib/data/participant";
import { MOCK_PROJECTS } from "@/lib/mock-chain";

export default async function InvestorPage() {
  const user = await requireParticipant("investor");
  const instructions = await getOwnInstructions(user);

  return (
    <>
      <PageTitle title="Marketplace" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <AssignedWallet address={user.walletAddress} />
        <Instructions text={instructions} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Projects</h2>
      <MockNotice>Minting arrives in Stage 5.</MockNotice>
      <div className="grid gap-4 md:grid-cols-3">
        {MOCK_PROJECTS.map((project) => (
          <Card key={project.id} title={project.name}>
            <p className="mb-2 text-sm text-slate-600">{project.description}</p>
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Mint price</dt>
                <dd>{project.mintPriceEth} ETH</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Minted</dt>
                <dd>{project.mintedCount}</dd>
              </div>
            </dl>
            <button disabled className={`${buttonClass} w-full`}>
              Mint NFT
            </button>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card title="My NFTs">
          <MockNotice />
          <p className="text-sm text-slate-500">You don&apos;t own any NFTs yet.</p>
        </Card>
      </div>
    </>
  );
}
