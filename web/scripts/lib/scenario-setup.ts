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

// Default private briefings. Only the Frosties creator's briefing mentions the plan; it needs the
// second wallet's address.
export function briefingFor(
  id: string,
  role: Role,
  ctx: { frostiesPrice: string; secondWallet: string; mixerLabel: string },
): string {
  if (id === FROSTIES_CREATOR) {
    return [
      `You run Frosties, a "utility NFT" collection. Holders are promised giveaways, early access to a`,
      `metaverse game and mint passes to later "seasons".`,
      ``,
      `1. Create your project: name "Frosties", mint price ${ctx.frostiesPrice} ETH, and a description that`,
      `   sells those promises.`,
      `2. When the buyers have minted, withdraw everything (Withdraw funds → Max).`,
      `3. Straight away, send the whole amount with Send test ETH to this wallet:`,
      `   ${ctx.secondWallet}`,
      `Don't tell the other participants.`,
    ].join("\n");
  }
  if (role === "creator") {
    return "Create your own NFT project with a name, a description and a mint price within the allowed range. Run it honestly and follow the organizer's briefing.";
  }
  if (role === "investor") {
    return `Browse the marketplace. Mint one NFT from Frosties (${ctx.frostiesPrice} ETH) and one from any other project you like.`;
  }
  return `When test ETH arrives in your wallet, forward it with "Transfer to ${ctx.mixerLabel}" in a few round amounts (for example several equal parts). Keep a little for gas.`;
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
    const briefing = briefingFor(p.id, p.role, {
      frostiesPrice: econ.frostiesPrice,
      secondWallet,
      mixerLabel: EXCHANGE2_LABEL,
    });
    await client.query(
      `INSERT INTO participant_private (scenario_id, participant_id, instructions, is_malicious)
       VALUES ($1, $2, $3, $4)`,
      [scenarioId, p.id, briefing, p.id === input.maliciousCreator],
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
