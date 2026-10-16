// LOCAL ONLY. Writes organizer-secrets/local-wallet-keys.csv: for each wallet in the active local
// scenario, its Hardhat development private key, for importing into MetaMask on this machine.
// These are Hardhat's public development keys (`hardhat node` prints them at startup) and are
// useless anywhere but the local chain. The file is still gitignored and owner-only.
//
//   npm run local:keys
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HDNodeWallet, Mnemonic } from "ethers";
import pg from "pg";

if (process.env.NEXT_PUBLIC_CHAIN_ID !== "31337") {
  console.error("local-wallet-keys only runs with NEXT_PUBLIC_CHAIN_ID=31337.");
  process.exit(1);
}

const mnemonic = Mnemonic.fromPhrase("test test test test test test test test test test test junk");
const devKeys = new Map<string, string>();
for (let i = 0; i < 20; i++) {
  const account = HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  devKeys.set(account.address.toLowerCase(), account.privateKey);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const scenario = await client.query<{ id: number; exchange1_address: string; exchange2_address: string }>(
    "SELECT id, exchange1_address, exchange2_address FROM scenarios WHERE is_active AND chain_id = 31337",
  );
  if (!scenario.rows[0]) throw new Error("No active local scenario. Run npm run db:seed first.");
  const { id, exchange1_address, exchange2_address } = scenario.rows[0];
  const { rows } = await client.query<{ id: string; username: string; role: string; wallet_address: string }>(
    "SELECT id, username, role, wallet_address FROM participants WHERE scenario_id = $1 ORDER BY id",
    [id],
  );

  const lines = ["login,participant_id,role,address,private_key"];
  const add = (login: string, id: string, role: string, address: string) =>
    lines.push(
      `${login},${id},${role},${address},${devKeys.get(address.toLowerCase()) ?? "(not a Hardhat dev account)"}`,
    );
  add("(Exchange 1)", "", "organizer", exchange1_address);
  for (const p of rows) add(p.username, p.id, p.role, p.wallet_address);
  add("(Exchange 2)", "", "organizer", exchange2_address);

  const dir = path.join(import.meta.dirname, "..", "..", "organizer-secrets");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "local-wallet-keys.csv"), lines.join("\n") + "\n", { mode: 0o600 });
  console.log("MetaMask import keys written to organizer-secrets/local-wallet-keys.csv (local chain only)");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
