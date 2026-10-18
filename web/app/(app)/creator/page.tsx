import { CreateProjectForm } from "@/components/creator/CreateProjectForm";
import { WithdrawForm } from "@/components/creator/WithdrawForm";
import { ContractsNotReady } from "@/components/ContractsNotReady";
import { Instructions } from "@/components/Instructions";
import { ProjectFacts } from "@/components/ProjectFacts";
import { Card, PageTitle } from "@/components/ui";
import { TransferSection } from "@/components/wallet/TransferSection";
import { WalletPanel } from "@/components/wallet/WalletPanel";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { requireParticipant } from "@/lib/auth";
import {
  ContractsNotReadyError,
  getCreatorAllowed,
  getMintPriceBounds,
  getProjectOfCreator,
  getScenarioContracts,
} from "@/lib/contracts";
import { getOwnInstructions } from "@/lib/data/participant";
import { listOwnTxs } from "@/lib/tx-verify";

async function loadChainState(scenarioId: number, wallet: string) {
  try {
    const contracts = await getScenarioContracts(scenarioId);
    const [project, allowed, bounds] = await Promise.all([
      getProjectOfCreator(scenarioId, contracts, wallet),
      getCreatorAllowed(contracts, wallet),
      getMintPriceBounds(contracts),
    ]);
    return { ok: true as const, contracts, project, allowed, bounds };
  } catch (error) {
    if (error instanceof ContractsNotReadyError) return { ok: false as const, message: error.message };
    throw error;
  }
}

export default async function CreatorPage() {
  const user = await requireParticipant("creator");
  const [instructions, chain, txs] = await Promise.all([
    getOwnInstructions(user),
    loadChainState(user.scenarioId, user.walletAddress),
    listOwnTxs(user),
  ]);

  return (
    <WalletProvider assignedWallet={user.walletAddress}>
      <PageTitle title="Creator dashboard" subtitle={`Welcome, ${user.displayName}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <WalletPanel />
        <Instructions text={instructions} />

        {!chain.ok ? (
          <ContractsNotReady message={chain.message} />
        ) : chain.project ? (
          <Card title={`My project: ${chain.project.name}`}>
            {chain.project.description && <p className="mb-3 text-[13px] text-ink-soft">{chain.project.description}</p>}
            <ProjectFacts project={chain.project} showFunds />
            <h3 className="mb-2 mt-4 text-[13px] font-semibold">Withdraw funds</h3>
            <WithdrawForm project={chain.project.address} availableWei={chain.project.availableWei} />
          </Card>
        ) : (
          <Card title="Create your project">
            <CreateProjectForm
              factory={chain.contracts.factory}
              minPriceWei={chain.bounds.minWei}
              maxPriceWei={chain.bounds.maxWei}
              allowed={chain.allowed}
            />
          </Card>
        )}

        <TransferSection title="Send test ETH" kind="transfer" rows={txs} />
      </div>
    </WalletProvider>
  );
}
