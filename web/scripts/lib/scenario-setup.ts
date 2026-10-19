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

// ── Frosties role-play defaults ─────────────────────────────────────────────────────────────
// The role-play re-enacts the Frosties NFT case (see docs/ORGANIZER-GUIDE.md). P01 runs the
// Frosties project; P02–P05 run ordinary projects; P06–P14 are buyers; P15 is the second wallet.
// Explorer labels follow the PICARD lab's names. The second wallet has no label, as in the lab,
// where investigators find it by following the money.

export type Profile = { username: string; displayName: string; explorerLabel: string };

export function profileFor(index: number): Profile {
  if (index === 1) return { username: "frosties", displayName: "Frosties creator", explorerLabel: "Contract creator" };
  if (index <= 5) {
    const n = index - 1;
    return { username: `creator${n}`, displayName: `Creator ${n}`, explorerLabel: `Creator ${n}` };
  }
  if (index <= 14) {
    const n = index - 5;
    return { username: `buyer${n}`, displayName: `Buyer ${n}`, explorerLabel: `Buyer ${n}` };
  }
  return { username: "mule", displayName: "Second wallet", explorerLabel: "" };
}

export const FROSTIES_CREATOR = "P01";
export const EXCHANGE1_LABEL = "Exchange (service wallet)";
export const EXCHANGE2_LABEL = "Tornado Cash (mixer stand-in)";

// The real sale was 0.04 ETH per token. Sepolia test ETH is scarce, so prices there are 10× smaller.
type ChainEconomics = {
  frostiesPrice: string;
  minMintPrice: string;
  maxMintPrice: string;
  funding: Record<Role, { gas: string; scenario: string }>;
};

export function economicsFor(chainId: number): ChainEconomics {
  if (chainId === 11155111) {
    return {
      frostiesPrice: "0.004",
      minMintPrice: "0.001",
      maxMintPrice: "0.005",
      funding: {
        creator: { gas: "0.05", scenario: "0" },
        investor: { gas: "0.02", scenario: "0.01" },
        mule: { gas: "0.01", scenario: "0" },
      },
    };
  }
  return {
    frostiesPrice: "0.04",
    minMintPrice: "0.01",
    maxMintPrice: "0.05",
    funding: {
      creator: { gas: "0.05", scenario: "0" },
      investor: { gas: "0.02", scenario: "0.1" },
      mule: { gas: "0.01", scenario: "0" },
    },
  };
}

// Default on-screen briefings: one text per role, identical for everyone with that role, so the
// Frosties creator's dashboard can't be told apart from the other creators'. The organizer hands
// the Frosties creator the secret plan privately (see secretPlanFor, kept in organizer notes).
export function briefingFor(role: Role, ctx: { frostiesPrice: string; mixerLabel: string }): string {
  if (role === "creator") {
    return [
      "1. Create your NFT project: choose a name, write a description of what holders will get, and set a mint price within the allowed range.",
      "2. Watch your project's numbers as buyers mint.",
      "3. Follow any further instructions your organizer gives you in person.",
    ].join("\n");
  }
  if (role === "investor") {
    return [
      "1. Browse the marketplace and read each project's description.",
      `2. Mint NFTs from the projects you'd like to back, for example Frosties (${ctx.frostiesPrice} ETH) and one other.`,
      "3. Check My NFTs afterwards.",
    ].join("\n");
  }
  return [
    "1. Watch Incoming transfers for test ETH arriving in your wallet.",
    `2. When it arrives, forward it with "Transfer to ${ctx.mixerLabel}" in a few round amounts.`,
    "3. Keep a little for gas.",
  ].join("\n");
}

// The Frosties creator's secret plan. Organizer-only (stored in organizer notes, never shown to
// participants); the organizer gives it to that participant on paper or in person.
export function secretPlanFor(ctx: { frostiesPrice: string; secondWallet: string }): string {
  return [
    "SECRET PLAN for the Frosties creator (give privately):",
    `1. Create the project "Frosties", mint price ${ctx.frostiesPrice} ETH, promising giveaways, early access to a metaverse game and mint passes to later "seasons".`,
    "2. When the buyers have minted, withdraw everything (Withdraw funds → Max).",
    `3. Straight away, send the whole amount with Send test ETH to: ${ctx.secondWallet}`,
  ].join("\n");
}

export type ScenarioInput = {
  name: string; // e.g. "Frosties"
  chainId: number;
  exchange1: string;
  exchange2: string;
  participants: { id: string; role: Role; address: string }[];
  maliciousCreator: string | null;
};

// participants must be ordered P01…P15 (index = position + 1).

// Inserts an active scenario with its participants and returns the generated login passwords.
// Caller owns the transaction.
export async function insertScenario(
  client: pg.Client,
  input: ScenarioInput,
): Promise<{ scenarioId: number; passwords: Map<string, string>; usernames: Map<string, string> }> {
  const econ = economicsFor(input.chainId);
  const scenario = await client.query<{ id: number }>(
    `INSERT INTO scenarios (name, chain_id, is_active, exchange1_address, exchange2_address,
                            min_mint_price_wei, max_mint_price_wei)
     VALUES ($1, $2, TRUE, $3, $4, $5, $6) RETURNING id`,
    [
      input.name,
      input.chainId,
      input.exchange1,
      input.exchange2,
      parseEther(econ.minMintPrice).toString(),
      parseEther(econ.maxMintPrice).toString(),
    ],
  );
  const scenarioId = scenario.rows[0].id;
  const passwords = new Map<string, string>();
  const usernames = new Map<string, string>();
  const secondWallet = input.participants.find((p) => p.role === "mule")?.address ?? "(the second wallet)";

  for (const [k, p] of input.participants.entries()) {
    const profile = profileFor(k + 1);
    const password = generateCardPassword();
    passwords.set(p.id, password);
    usernames.set(p.id, profile.username);
    await client.query(
      `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.id, scenarioId, profile.displayName, p.role, p.address, await hashPassword(password), profile.username],
    );
    const briefing = briefingFor(p.role, { frostiesPrice: econ.frostiesPrice, mixerLabel: EXCHANGE2_LABEL });
    const malicious = p.id === input.maliciousCreator;
    const notes = malicious ? secretPlanFor({ frostiesPrice: econ.frostiesPrice, secondWallet }) : "";
    await client.query(
      `INSERT INTO participant_private (scenario_id, participant_id, instructions, is_malicious, organizer_notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [scenarioId, p.id, briefing, malicious, notes],
    );
    await client.query("INSERT INTO known_addresses (scenario_id, address, public_label) VALUES ($1, $2, $3)", [
      scenarioId,
      p.address,
      profile.explorerLabel,
    ]);
  }

  await client.query(
    `INSERT INTO known_addresses (scenario_id, address, public_label) VALUES ($1, $2, $3), ($1, $4, $5)`,
    [scenarioId, input.exchange1, EXCHANGE1_LABEL, input.exchange2, EXCHANGE2_LABEL],
  );
  for (const [role, amounts] of Object.entries(econ.funding)) {
    await client.query("INSERT INTO funding_plan (scenario_id, role, gas_wei, scenario_wei) VALUES ($1, $2, $3, $4)", [
      scenarioId,
      role,
      parseEther(amounts.gas).toString(),
      parseEther(amounts.scenario).toString(),
    ]);
  }
  return { scenarioId, passwords, usernames };
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
