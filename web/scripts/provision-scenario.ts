// Provisions a NEW scenario with freshly generated wallets (decision D8: the organizer creates
// the wallets and logins). Works for the local chain and Sepolia.
//
//   npm run provision -- --name "Sepolia live run" [--exchange1 0x...] [--malicious P03]
//                        [--replace] [--secrets-dir <dir>]
//
// - Generates 15 participant wallets and Exchange 2 (and Exchange 1 unless --exchange1 gives an
//   existing, already-funded organizer address).
// - Stores ONLY public addresses and password hashes in the database.
// - Writes the private keys and login passwords to <repo>/organizer-secrets/ (gitignored, mode
//   600): the organizer imports each key into MetaMask on the prepared device and prints the
//   login cards. Keep these files off shared machines and delete them after the event.
// - --replace deactivates the current active scenario for this chain. Its data and on-chain
//   history stay intact; nothing on Sepolia can be erased.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Wallet, getAddress, isAddress } from "ethers";
import pg from "pg";
import { ensureOrganizer, insertScenario, participantId, roleForIndex } from "./lib/scenario-setup.ts";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
}

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
if (chainId !== 31337 && chainId !== 11155111) {
  console.error("NEXT_PUBLIC_CHAIN_ID must be 31337 (local) or 11155111 (Sepolia).");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const name = arg("name");
if (!name) {
  console.error(
    'Usage: npm run provision -- --name "<scenario name>" [--exchange1 0x...] [--malicious P03] [--replace]',
  );
  process.exit(1);
}
const exchange1Arg = arg("exchange1");
if (exchange1Arg && !isAddress(exchange1Arg)) {
  console.error("--exchange1 must be a valid address.");
  process.exit(1);
}
const malicious = arg("malicious");
if (malicious && !/^P0[1-5]$/.test(malicious)) {
  console.error("--malicious must be one of the creators P01–P05.");
  process.exit(1);
}
const replace = process.argv.includes("--replace");
const secretsDir = arg("secrets-dir") ?? path.join(import.meta.dirname, "..", "..", "organizer-secrets");

const wallets = Array.from({ length: 15 }, () => Wallet.createRandom());
const exchange1Wallet = exchange1Arg ? null : Wallet.createRandom();
const exchange1 = exchange1Arg ? getAddress(exchange1Arg) : exchange1Wallet!.address;
const exchange2Wallet = Wallet.createRandom();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");
  const active = await client.query<{ id: number; name: string }>(
    "SELECT id, name FROM scenarios WHERE chain_id = $1 AND is_active",
    [chainId],
  );
  if (active.rows[0]) {
    if (!replace) throw new Error(`Scenario "${active.rows[0].name}" is active on chain ${chainId}. Use --replace.`);
    await client.query("UPDATE scenarios SET is_active = FALSE WHERE id = $1", [active.rows[0].id]);
    await client.query("DELETE FROM sessions WHERE scenario_id = $1", [active.rows[0].id]);
    console.log(`deactivated scenario #${active.rows[0].id} "${active.rows[0].name}" (kept for the record)`);
  }

  const participants = wallets.map((w, k) => ({
    id: participantId(k + 1),
    role: roleForIndex(k + 1),
    address: w.address,
  }));
  const { scenarioId, passwords, usernames } = await insertScenario(client, {
    name,
    chainId,
    exchange1,
    exchange2: exchange2Wallet.address,
    participants,
    maliciousCreator: malicious,
  });
  const organizerPassword = await ensureOrganizer(client, false);
  await client.query("COMMIT");

  await mkdir(secretsDir, { recursive: true });
  const base = path.join(secretsDir, `scenario-${scenarioId}-chain-${chainId}`);
  const secrets = {
    warning: "TEST WALLETS ONLY. Never send real funds. Keep this file private and delete it after the role-play.",
    scenarioId,
    chainId,
    name,
    participants: participants.map((p, k) => ({
      ...p,
      username: usernames.get(p.id),
      privateKey: wallets[k].privateKey,
      loginPassword: passwords.get(p.id),
    })),
    exchange1: { address: exchange1, privateKey: exchange1Wallet?.privateKey ?? null },
    exchange2: { address: exchange2Wallet.address, privateKey: exchange2Wallet.privateKey },
    organizerPassword,
  };
  await writeFile(`${base}-wallets.json`, JSON.stringify(secrets, null, 2) + "\n", { mode: 0o600 });
  const cards = [
    "login,password,role,participant_id",
    ...participants.map((p) => `${usernames.get(p.id)},${passwords.get(p.id)},${p.role},${p.id}`),
  ];
  if (organizerPassword) cards.push(`organizer,${organizerPassword},organizer,`);
  await writeFile(`${base}-login-cards.csv`, cards.join("\n") + "\n", { mode: 0o600 });

  console.log(`provisioned scenario #${scenarioId} "${name}" on chain ${chainId}: 15 participants + Exchange 1/2`);
  console.log(
    `Exchange 1: ${exchange1}${exchange1Arg ? " (existing)" : " (new — fund it before running fund-wallets)"}`,
  );
  console.log(`secrets written to ${base}-wallets.json and -login-cards.csv (private: keep off shared machines)`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
