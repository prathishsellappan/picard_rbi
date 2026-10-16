// Seeds a LOCAL rehearsal scenario (chain 31337 only).
//
// Wallet addresses are the well-known Hardhat development accounts, which are public test keys
// and must never hold real funds. Only public addresses are stored. For fresh wallets (and for
// Sepolia) use provision-scenario.ts instead.
//
// Usage: npm run db:seed              create the local scenario
//        npm run db:seed -- --reset   delete the local scenario's app data and re-create it
//
// Generated login passwords are written to <repo>/organizer-secrets/ (gitignored) for the
// organizer's login cards.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HDNodeWallet, Mnemonic } from "ethers";
import pg from "pg";
import { ensureOrganizer, insertScenario, participantId, roleForIndex } from "./lib/scenario-setup.ts";

const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";
const LOCAL_CHAIN_ID = 31337;
const MALICIOUS_CREATOR = "P03"; // organizer-only knowledge; change freely for rehearsals

if (process.env.NEXT_PUBLIC_CHAIN_ID !== String(LOCAL_CHAIN_ID)) {
  console.error(`seed-local only runs with NEXT_PUBLIC_CHAIN_ID=${LOCAL_CHAIN_ID}.`);
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const reset = process.argv.includes("--reset");

function hardhatAddress(index: number): string {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(HARDHAT_MNEMONIC), `m/44'/60'/0'/0/${index}`).address;
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");

  const existing = await client.query<{ id: number }>("SELECT id FROM scenarios WHERE chain_id = $1 AND is_active", [
    LOCAL_CHAIN_ID,
  ]);
  if (existing.rows.length > 0) {
    if (!reset) {
      throw new Error("An active local scenario already exists. Re-run with --reset to replace it.");
    }
    await client.query("DELETE FROM sessions WHERE scenario_id = $1", [existing.rows[0].id]);
    await client.query("DELETE FROM scenarios WHERE id = $1", [existing.rows[0].id]);
    console.log("deleted previous local scenario (application data only)");
  }

  // Account 0 = Exchange 1, 1–5 creators, 6–14 investors, 15 mule, 16 = Exchange 2.
  const participants = Array.from({ length: 15 }, (_, k) => ({
    id: participantId(k + 1),
    role: roleForIndex(k + 1),
    address: hardhatAddress(k + 1),
  }));
  const { scenarioId, passwords, usernames } = await insertScenario(client, {
    name: "Local rehearsal",
    chainId: LOCAL_CHAIN_ID,
    exchange1: hardhatAddress(0),
    exchange2: hardhatAddress(16),
    participants,
    maliciousCreator: MALICIOUS_CREATOR,
  });
  const organizerPassword = await ensureOrganizer(client, true);
  await client.query("COMMIT");

  const lines = [
    "login,password,role,participant_id",
    ...participants.map((p) => `${usernames.get(p.id)},${passwords.get(p.id)},${p.role},${p.id}`),
  ];
  lines.push(`organizer,${organizerPassword},organizer,`);
  const secretsDir = path.join(import.meta.dirname, "..", "..", "organizer-secrets");
  await mkdir(secretsDir, { recursive: true });
  const file = path.join(secretsDir, "credentials-local.csv");
  await writeFile(file, lines.join("\n") + "\n", { mode: 0o600 });

  console.log(`seeded local scenario #${scenarioId}: 15 participants, Exchange 1/2, funding plan`);
  console.log(`login cards written to ${path.relative(process.cwd(), file)} (gitignored)`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
