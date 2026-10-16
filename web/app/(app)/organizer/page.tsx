import { Card, Mono, PageTitle } from "@/components/ui";
import { requireOrganizer } from "@/lib/auth";
import { getServerConfig } from "@/lib/config";
import { getFundingPlan, getScenarioForOrganizer, listParticipantsForOrganizer } from "@/lib/data/organizer";
import { formatEth } from "@/lib/eth";
import { PARTICIPANT_ROLES } from "@/lib/roles";

export default async function OrganizerOverviewPage() {
  await requireOrganizer();
  const { chain } = getServerConfig();
  const scenario = await getScenarioForOrganizer(chain.id);

  if (!scenario) {
    return (
      <>
        <PageTitle title="Organizer overview" />
        <Card title="No active scenario">
          <p className="text-sm text-slate-600">
            No active scenario for {chain.name}. For local development run <code>npm run db:seed</code>.
          </p>
        </Card>
      </>
    );
  }

  const [participants, funding] = await Promise.all([
    listParticipantsForOrganizer(scenario.id),
    getFundingPlan(scenario.id),
  ]);
  const counts = Object.fromEntries(
    PARTICIPANT_ROLES.map((role) => [role, participants.filter((p) => p.role === role).length]),
  );
  const malicious = participants.filter((p) => p.is_malicious).map((p) => p.id);
  const totalFundingWei = funding.reduce(
    (sum, f) => sum + (BigInt(f.gas_wei) + BigInt(f.scenario_wei)) * BigInt(counts[f.role] ?? 0),
    0n,
  );

  const contracts: [string, string | null][] = [
    ["ProjectFactory", scenario.factory_address],
    ["Marketplace", scenario.marketplace_address],
    ["ScenarioNFT", scenario.nft_address],
  ];

  return (
    <>
      <PageTitle title="Organizer overview" subtitle={`${scenario.name} · ${chain.name} (${chain.id})`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Participants">
          <ul className="space-y-1 text-sm">
            {PARTICIPANT_ROLES.map((role) => (
              <li key={role} className="flex justify-between">
                <span className="capitalize">{role}s</span>
                <span>{counts[role]}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-slate-100 pt-1">
              <span>Malicious creator (organizer only)</span>
              <span className="font-medium text-red-700">{malicious.join(", ") || "none set"}</span>
            </li>
          </ul>
        </Card>

        <Card title="Exchanges">
          <p className="text-sm text-slate-500">Exchange 1</p>
          <Mono>{scenario.exchange1_address ?? "not set"}</Mono>
          <p className="mt-2 text-sm text-slate-500">Exchange 2</p>
          <Mono>{scenario.exchange2_address ?? "not set"}</Mono>
        </Card>

        <Card title="Initial funding plan">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Role</th>
                <th className="py-1">Gas (each)</th>
                <th className="py-1">Scenario (each)</th>
              </tr>
            </thead>
            <tbody>
              {funding.map((f) => (
                <tr key={f.role} className="border-t border-slate-100">
                  <td className="py-1 capitalize">{f.role}</td>
                  <td className="py-1">{formatEth(f.gas_wei)} ETH</td>
                  <td className="py-1">{formatEth(f.scenario_wei)} ETH</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            Exchange 1 needs at least <strong>{formatEth(totalFundingWei)} ETH</strong> plus its own gas.
          </p>
          <p className="mt-1 text-xs text-slate-500">Distribution runs from an organizer script (Stage 3).</p>
        </Card>

        <Card title="Contracts">
          <ul className="space-y-2 text-sm">
            {contracts.map(([name, address]) => (
              <li key={name}>
                <span className="text-slate-500">{name}: </span>
                {address ? <Mono>{address}</Mono> : <span className="text-slate-400">not deployed</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
