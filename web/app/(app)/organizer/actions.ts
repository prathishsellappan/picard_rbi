"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/ActionForm";
import { normalizeAddress } from "@/lib/address";
import { AuthError, authorize } from "@/lib/auth";
import { getServerConfig } from "@/lib/config";
import { getScenarioForOrganizer } from "@/lib/data/organizer";
import { query, queryOne, transaction } from "@/lib/db";
import { parseEthAmount } from "@/lib/eth";
import { generateCardPassword, hashPassword } from "@/lib/password";
import { PARTICIPANT_ROLES } from "@/lib/roles";

// Every Server Function is a public endpoint, so each one re-checks the organizer role.
async function organizerScenarioId(): Promise<number> {
  await authorize(["organizer"]);
  const scenario = await getScenarioForOrganizer(getServerConfig().chain.id);
  if (!scenario) throw new Error("No active scenario for the configured chain. Run the seed script first.");
  return scenario.id;
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function errorResult(error: unknown): ActionResult {
  if (error instanceof AuthError) return fail(error.message);
  const pgCode = (error as { code?: string }).code;
  if (pgCode === "23505") return fail("That ID, login username or wallet address is already used in this scenario.");
  console.error(error);
  return fail(error instanceof Error ? error.message : "Unexpected error.");
}

const participantSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^P\d{2}$/, "ID must look like P01"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z][a-z0-9]{2,31}$/,
      "Login username: 3–32 lowercase letters/digits, starting with a letter (e.g. investor3)",
    ),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(PARTICIPANT_ROLES),
  walletAddress: z.string(),
  instructions: z.string().max(4000).default(""),
  organizerNotes: z.string().max(4000).default(""),
  isMalicious: z.boolean(),
});

function readParticipantForm(formData: FormData) {
  return participantSchema.safeParse({
    id: formData.get("id"),
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    walletAddress: formData.get("walletAddress"),
    instructions: formData.get("instructions") ?? "",
    organizerNotes: formData.get("organizerNotes") ?? "",
    isMalicious: formData.get("isMalicious") === "on",
  });
}

async function checkNotExchange(scenarioId: number, address: string): Promise<string | null> {
  const clash = await queryOne<{ id: number }>(
    `SELECT id FROM scenarios WHERE id = $1 AND (lower(exchange1_address) = lower($2) OR lower(exchange2_address) = lower($2))`,
    [scenarioId, address],
  );
  return clash ? "That address is configured as an exchange." : null;
}

export async function updateParticipantAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const scenarioId = await organizerScenarioId();
    const parsed = readParticipantForm(formData);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const p = parsed.data;
    const wallet = normalizeAddress(p.walletAddress);
    if (!wallet) return fail("Wallet address is not a valid address (check the checksum).");
    if (p.isMalicious && p.role !== "creator") return fail("Only a creator can be marked malicious.");
    const exchangeClash = await checkNotExchange(scenarioId, wallet);
    if (exchangeClash) return fail(exchangeClash);

    const found = await transaction(async (q) => {
      const updated = await q(
        `UPDATE participants SET display_name = $3, role = $4, wallet_address = $5, username = $6
          WHERE scenario_id = $1 AND id = $2 RETURNING id`,
        [scenarioId, p.id, p.displayName, p.role, wallet, p.username],
      );
      if (updated.length === 0) return false;
      await q(
        `INSERT INTO participant_private (scenario_id, participant_id, instructions, is_malicious, organizer_notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (scenario_id, participant_id)
       DO UPDATE SET instructions = EXCLUDED.instructions, is_malicious = EXCLUDED.is_malicious,
                     organizer_notes = EXCLUDED.organizer_notes`,
        [scenarioId, p.id, p.instructions, p.isMalicious, p.organizerNotes],
      );
      await q("DELETE FROM known_addresses WHERE scenario_id = $1 AND public_label = $2", [scenarioId, p.id]);
      await q("INSERT INTO known_addresses (scenario_id, address, public_label) VALUES ($1, $2, $3)", [
        scenarioId,
        wallet,
        p.id,
      ]);
      return true;
    });
    if (!found) return fail(`Participant ${p.id} not found.`);
    revalidatePath("/organizer", "layout");
    return { ok: true, message: `Saved ${p.id}.` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createParticipantAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const scenarioId = await organizerScenarioId();
    const parsed = readParticipantForm(formData);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const p = parsed.data;
    const wallet = normalizeAddress(p.walletAddress);
    if (!wallet) return fail("Wallet address is not a valid address (check the checksum).");
    if (p.isMalicious && p.role !== "creator") return fail("Only a creator can be marked malicious.");
    const exchangeClash = await checkNotExchange(scenarioId, wallet);
    if (exchangeClash) return fail(exchangeClash);

    const password = generateCardPassword();
    const passwordHash = await hashPassword(password);
    await transaction(async (q) => {
      await q(
        `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, scenarioId, p.displayName, p.role, wallet, passwordHash, p.username],
      );
      await q(
        `INSERT INTO participant_private (scenario_id, participant_id, instructions, is_malicious, organizer_notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [scenarioId, p.id, p.instructions, p.isMalicious, p.organizerNotes],
      );
      await q("INSERT INTO known_addresses (scenario_id, address, public_label) VALUES ($1, $2, $3)", [
        scenarioId,
        wallet,
        p.id,
      ]);
    });
    revalidatePath("/organizer", "layout");
    return { ok: true, message: `Created ${p.id}. Login card: ${p.username} / ${password} (password shown once)` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const scenarioId = await organizerScenarioId();
    const id = z
      .string()
      .regex(/^P\d{2}$/)
      .safeParse(formData.get("id"));
    if (!id.success) return fail("Invalid participant ID.");
    const password = generateCardPassword();
    const updated = await query(
      "UPDATE participants SET password_hash = $3 WHERE scenario_id = $1 AND id = $2 RETURNING id",
      [scenarioId, id.data, await hashPassword(password)],
    );
    if (updated.length === 0) return fail("Participant not found.");
    await query("DELETE FROM sessions WHERE scenario_id = $1 AND participant_id = $2", [scenarioId, id.data]);
    return { ok: true, message: `New password for ${id.data} (shown once): ${password}` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateScenarioAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const scenarioId = await organizerScenarioId();
    const exchange1 = normalizeAddress(String(formData.get("exchange1") ?? ""));
    const exchange2 = normalizeAddress(String(formData.get("exchange2") ?? ""));
    if (!exchange1 || !exchange2) return fail("Exchange 1 and Exchange 2 must be valid addresses.");
    if (exchange1 === exchange2) return fail("Exchange 1 and Exchange 2 must be different addresses.");

    const participantClash = await queryOne<{ id: string }>(
      "SELECT id FROM participants WHERE scenario_id = $1 AND lower(wallet_address) IN (lower($2), lower($3))",
      [scenarioId, exchange1, exchange2],
    );
    if (participantClash) return fail(`An exchange address is already assigned to ${participantClash.id}.`);

    const minPrice = parseEthAmount(String(formData.get("minMintPrice") ?? ""));
    const maxPrice = parseEthAmount(String(formData.get("maxMintPrice") ?? ""));
    if (minPrice === null || maxPrice === null || minPrice <= 0n || minPrice > maxPrice) {
      return fail("Mint price bounds must be positive ETH amounts with min ≤ max.");
    }

    const funding: { role: string; gas: bigint; scenario: bigint }[] = [];
    for (const role of PARTICIPANT_ROLES) {
      const gas = parseEthAmount(String(formData.get(`gas_${role}`) ?? ""));
      const scenario = parseEthAmount(String(formData.get(`scenario_${role}`) ?? ""));
      if (gas === null || scenario === null) return fail(`Funding amounts for ${role} must be valid ETH amounts.`);
      funding.push({ role, gas, scenario });
    }

    await transaction(async (q) => {
      await q(
        `UPDATE scenarios SET exchange1_address = $2, exchange2_address = $3,
              min_mint_price_wei = $4, max_mint_price_wei = $5 WHERE id = $1`,
        [scenarioId, exchange1, exchange2, minPrice.toString(), maxPrice.toString()],
      );
      await q("DELETE FROM known_addresses WHERE scenario_id = $1 AND public_label IN ('Exchange 1', 'Exchange 2')", [
        scenarioId,
      ]);
      await q(
        `INSERT INTO known_addresses (scenario_id, address, public_label)
       VALUES ($1, $2, 'Exchange 1'), ($1, $3, 'Exchange 2')`,
        [scenarioId, exchange1, exchange2],
      );
      for (const f of funding) {
        await q(
          `INSERT INTO funding_plan (scenario_id, role, gas_wei, scenario_wei) VALUES ($1, $2, $3, $4)
         ON CONFLICT (scenario_id, role) DO UPDATE SET gas_wei = EXCLUDED.gas_wei, scenario_wei = EXCLUDED.scenario_wei`,
          [scenarioId, f.role, f.gas.toString(), f.scenario.toString()],
        );
      }
    });
    revalidatePath("/organizer", "layout");
    return { ok: true, message: "Scenario saved." };
  } catch (error) {
    return errorResult(error);
  }
}
