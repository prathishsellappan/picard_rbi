import { ActionForm } from "@/components/ActionForm";
import { Card, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { requireOrganizer } from "@/lib/auth";
import { getServerConfig } from "@/lib/config";
import { getFundingPlan, getScenarioForOrganizer } from "@/lib/data/organizer";
import { formatEth } from "@/lib/eth";
import { updateScenarioAction } from "../actions";

export default async function OrganizerScenarioPage() {
  await requireOrganizer();
  const scenario = await getScenarioForOrganizer(getServerConfig().chain.id);
  if (!scenario) return <PageTitle title="Scenario" subtitle="No active scenario. Run the seed script." />;
  const funding = await getFundingPlan(scenario.id);

  return (
    <>
      <PageTitle title="Scenario configuration" subtitle={scenario.name} />
      <ActionForm action={updateScenarioAction} className="space-y-4">
        <Card title="Exchange addresses (organizer-controlled)">
          <div className="grid gap-3">
            <label className="text-xs">
              Exchange 1 (initial funding source)
              <input
                name="exchange1"
                defaultValue={scenario.exchange1_address ?? ""}
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="text-xs">
              Exchange 2 (final destination)
              <input
                name="exchange2"
                defaultValue={scenario.exchange2_address ?? ""}
                className={`${inputClass} font-mono`}
              />
            </label>
          </div>
        </Card>

        <Card title="Mint price bounds (ETH)">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              Minimum
              <input name="minMintPrice" defaultValue={formatEth(scenario.min_mint_price_wei)} className={inputClass} />
            </label>
            <label className="text-xs">
              Maximum
              <input name="maxMintPrice" defaultValue={formatEth(scenario.max_mint_price_wei)} className={inputClass} />
            </label>
          </div>
        </Card>

        <Card title="Initial funding per wallet (ETH)">
          <p className="mb-3 text-xs text-slate-500">
            Gas funding covers transaction fees. Scenario funds are what the participant spends in the role-play (for
            investors: mint payments). Both are sent in one transfer per wallet.
          </p>
          <div className="space-y-2">
            {funding.map((f) => (
              <div key={f.role} className="grid items-end gap-3 md:grid-cols-3">
                <span className="text-sm capitalize">{f.role}</span>
                <label className="text-xs">
                  Gas
                  <input name={`gas_${f.role}`} defaultValue={formatEth(f.gas_wei)} className={inputClass} />
                </label>
                <label className="text-xs">
                  Scenario funds
                  <input name={`scenario_${f.role}`} defaultValue={formatEth(f.scenario_wei)} className={inputClass} />
                </label>
              </div>
            ))}
          </div>
        </Card>

        <button type="submit" className={buttonClass}>
          Save scenario
        </button>
      </ActionForm>
    </>
  );
}
