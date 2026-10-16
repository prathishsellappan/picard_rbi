// Shared by the organizer scenario scripts (seed-local.ts, provision-scenario.ts).
// Writes the application-side records for a scenario. Only public addresses and password
// hashes go into the database, never keys.
import { parseEther } from "ethers";
import type pg from "pg";
import { generateCardPassword, hashPassword } from "../../lib/password.ts";

export type Role = "creator" | "investor" | "mule";

// P01–P05 creators, P06–P14 investors, P15 mule.
export function roleForIndex(i: number): Role {
  return i <= 5 ? "creator" : i <= 14 ? "investor" : "mule";
}

export function participantId(i: number): string {
  return `P${String(i).padStart(2, "0")}`;
}

export const DEFAULT_INSTRUCTIONS: Record<Role, string> = {
  creator: "Create your project, set a mint price, and follow the organizer's briefing for your project.",
  investor: "Browse the marketplace and mint NFTs from the projects named in your briefing.",
  mule: "Watch your wallet for incoming test ETH and forward it to Exchange 2 when instructed.",
};

// Initial funding per wallet: gas money is kept separate from scenario funds.
export const DEFAULT_FUNDING: Record<Role, { gas: string; scenario: string }> = {
  creator: { gas: "0.05", scenario: "0" },
  investor: { gas: "0.02", scenario: "0.03" },
  mule: { gas: "0.01", scenario: "0" },
};

export type ScenarioInput = {
  name: string;
  chainId: number;
  exchange1: string;
  exchange2: string;
  participants: { id: string; role: Role; address: string }[];
  maliciousCreator: string | null;
};

// Inserts an active scenario with its participants and returns the generated login passwords.
// Caller owns the transaction.
export async function insertScenario(
  client: pg.Client,
  input: ScenarioInput,
): Promise<{ scenarioId: number; passwords: Map<string, string> }> {
  const scenario = await client.query<{ id: number }>(
    `INSERT INTO scenarios (name, chain_id, is_active, exchange1_address, exchange2_address)
     VALUES ($1, $2, TRUE, $3, $4) RETURNING id`,
    [input.name, input.chainId, input.exchange1, input.exchange2],
  );
  const scenarioId = scenario.rows[0].id;
  const passwords = new Map<string, string>();

  for (const p of input.participants) {
    const password = generateCardPassword();
    passwords.set(p.id, password);
    await client.query(
      `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.id, scenarioId, `Participant ${p.id}`, p.role, p.address, await hashPassword(password)],
    );
    await client.query(
      `INSERT INTO participant_private (scenario_id, participant_id, instructions, is_malicious)
       VALUES ($1, $2, $3, $4)`,
      [scenarioId, p.id, DEFAULT_INSTRUCTIONS[p.role], p.id === input.maliciousCreator],
    );
    await client.query("INSERT INTO known_addresses (scenario_id, address, public_label) VALUES ($1, $2, $3)", [
      scenarioId,
      p.address,
      p.id,
    ]);
  }

  await client.query(
    `INSERT INTO known_addresses (scenario_id, address, public_label)
     VALUES ($1, $2, 'Exchange 1'), ($1, $3, 'Exchange 2')`,
    [scenarioId, input.exchange1, input.exchange2],
  );
  for (const [role, amounts] of Object.entries(DEFAULT_FUNDING)) {
    await client.query("INSERT INTO funding_plan (scenario_id, role, gas_wei, scenario_wei) VALUES ($1, $2, $3, $4)", [
      scenarioId,
      role,
      parseEther(amounts.gas).toString(),
      parseEther(amounts.scenario).toString(),
    ]);
  }
  return { scenarioId, passwords };
}

// Ensures an organizer login exists. Returns a new password only if one was created or reset.
export async function ensureOrganizer(client: pg.Client, reset: boolean): Promise<string | null> {
  const existing = await client.query("SELECT id FROM organizers WHERE username = 'organizer'");
  if (existing.rows.length > 0 && !reset) return null;
  const password = generateCardPassword(14);
  await client.query(
    `INSERT INTO organizers (username, password_hash) VALUES ('organizer', $1)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [await hashPassword(password)],
  );
  await client.query(
    "DELETE FROM sessions WHERE organizer_id = (SELECT id FROM organizers WHERE username = 'organizer')",
  );
  return password;
}
