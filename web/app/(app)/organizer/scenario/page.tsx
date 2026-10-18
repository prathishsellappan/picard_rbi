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
            <label className="text-[11.5px]">
              Exchange 1 address (initial funding source)
              <input
                name="exchange1"
                defaultValue={scenario.exchange1_address ?? ""}
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="text-[11.5px]">
              Exchange 1 explorer label
              <input name="exchange1Label" defaultValue={scenario.exchange1_label} className={inputClass} />
            </label>
            <label className="text-[11.5px]">
              Exchange 2 address (final destination)
              <input
                name="exchange2"
                defaultValue={scenario.exchange2_address ?? ""}
                className={`${inputClass} font-mono`}
              />
            </label>
            <label className="text-[11.5px]">
              Exchange 2 explorer label
              <input name="exchange2Label" defaultValue={scenario.exchange2_label} className={inputClass} />
            </label>
          </div>
        </Card>

        <Card title="Mint price bounds (ETH)">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-[11.5px]">
              Minimum
              <input name="minMintPrice" defaultValue={formatEth(scenario.min_mint_price_wei)} className={inputClass} />
            </label>
            <label className="text-[11.5px]">
              Maximum
              <input name="maxMintPrice" defaultValue={formatEth(scenario.max_mint_price_wei)} className={inputClass} />
            </label>
          </div>
        </Card>

        <Card title="Initial funding per wallet (ETH)">
          <p className="mb-3 text-[11.5px] text-ink-muted">
            Gas funding covers transaction fees. Scenario funds are what the participant spends in the role-play (for
            investors: mint payments). Both are sent in one transfer per wallet.
          </p>
          <div className="space-y-2">
            {funding.map((f) => (
              <div key={f.role} className="grid items-end gap-3 md:grid-cols-3">
                <span className="text-[13px] capitalize">{f.role}</span>
                <label className="text-[11.5px]">
                  Gas
                  <input name={`gas_${f.role}`} defaultValue={formatEth(f.gas_wei)} className={inputClass} />
                </label>
                <label className="text-[11.5px]">
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
