import { ContractsNotReady } from "@/components/ContractsNotReady";
import { Instructions } from "@/components/Instructions";
import { MintButton } from "@/components/investor/MintButton";
import { ProjectFacts } from "@/components/ProjectFacts";
import { Card, PageTitle } from "@/components/ui";
import { MyTransactionsList } from "@/components/wallet/MyTransactions";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { requireParticipant } from "@/lib/auth";
import { ContractsNotReadyError, getScenarioContracts, listOwnedNfts, listProjects } from "@/lib/contracts";
import { getOwnInstructions } from "@/lib/data/participant";
import { listOwnTxs } from "@/lib/tx-verify";

async function loadChainState(scenarioId: number, wallet: string) {
  try {
    const contracts = await getScenarioContracts(scenarioId);
    const [projects, nfts] = await Promise.all([listProjects(scenarioId, contracts), listOwnedNfts(contracts, wallet)]);
    return { ok: true as const, contracts, projects, nfts };
  } catch (error) {
    if (error instanceof ContractsNotReadyError) return { ok: false as const, message: error.message };
    throw error;
  }
}

export default async function InvestorPage() {
  const user = await requireParticipant("investor");
  const [instructions, chain, txs] = await Promise.all([
    getOwnInstructions(user),
    loadChainState(user.scenarioId, user.walletAddress),
    listOwnTxs(user),
  ]);
  const nameOf = (address: string) =>
    chain.ok
      ? (chain.projects.find((p) => p.address.toLowerCase() === address.toLowerCase())?.name ?? address)
      : address;

  return (
    <WalletProvider assignedWallet={user.walletAddress}>
      <PageTitle title="Marketplace" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <WalletPanel />
        <Instructions text={instructions} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Projects</h2>
      {!chain.ok ? (
        <ContractsNotReady message={chain.message} />
      ) : chain.projects.length === 0 ? (
        <p className="text-sm text-slate-500">No projects have been created yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {chain.projects.map((project) => (
            <Card key={project.address} title={project.name}>
              {project.description && <p className="mb-2 text-sm text-slate-600">{project.description}</p>}
              <div className="mb-3">
                <ProjectFacts project={project} showFunds={false} />
              </div>
              <MintButton
                marketplace={chain.contracts.marketplace}
                project={project.address}
                projectName={project.name}
                mintPriceWei={project.mintPriceWei}
              />
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card title="My NFTs">
          {!chain.ok || chain.nfts.length === 0 ? (
            <p className="text-sm text-slate-500">You don&apos;t own any NFTs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {chain.nfts.map((nft) => (
                <li key={nft.tokenId} className="flex justify-between py-2">
                  <span>Token #{nft.tokenId}</span>
                  <span className="text-slate-600">{nameOf(nft.project)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">Read from the NFT contract (on-chain ownership).</p>
        </Card>
        <Card title="My transactions">
          <MyTransactionsList rows={txs} />
        </Card>
      </div>
    </WalletProvider>
  );
}
