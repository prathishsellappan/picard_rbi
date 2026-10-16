// Allows every creator in the active scenario to create a project on the factory.
// Safe to re-run: creators already allowed on-chain are skipped.
//
//   npx hardhat run scripts/register-creators.ts --network localhost
import { connect, getActiveScenario, openDb } from "./lib/common.js";

const { ethers, chainId, deployer } = await connect();
const db = await openDb();

try {
  const scenario = await getActiveScenario(db, chainId);
  if (!scenario.factory_address) throw new Error("No factory deployed for this scenario. Run deploy.ts first.");
  const factory = await ethers.getContractAt("ProjectFactory", scenario.factory_address, deployer);

  const { rows: creators } = await db.query<{ id: string; wallet_address: string }>(
    "SELECT id, wallet_address FROM participants WHERE scenario_id = $1 AND role = 'creator' ORDER BY id",
    [scenario.id],
  );

  for (const creator of creators) {
    if (await factory.isCreatorAllowed(creator.wallet_address)) {
      console.log(`  ${creator.id} ${creator.wallet_address} already allowed`);
      continue;
    }
    const receipt = await (await factory.setCreatorAllowed(creator.wallet_address, true)).wait();
    if (!receipt || receipt.status !== 1) throw new Error(`setCreatorAllowed failed for ${creator.id}`);
    console.log(`  ${creator.id} ${creator.wallet_address} allowed (tx ${receipt.hash})`);
  }
  console.log(`${creators.length} creators registered on ${scenario.factory_address}.`);
} finally {
  await db.end();
}
