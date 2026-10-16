// LOCAL ONLY. After the Hardhat node restarts, the local chain is empty again: the scenario's
// contracts and transactions no longer exist. This clears the scenario's chain-derived records
// (contract addresses, indexed data, transaction records, projects, funding records) so it can be
// redeployed, while keeping participants, login passwords, instructions and settings unchanged.
//
//   npm run chain:reset-local
//
// Never used for Sepolia: Sepolia history is permanent, so a new scenario is provisioned instead.
import pg from "pg";

if (process.env.NEXT_PUBLIC_CHAIN_ID !== "31337") {
  console.error("reset-chain-state only runs with NEXT_PUBLIC_CHAIN_ID=31337 (local chain).");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query<{ id: number; name: string }>(
    "SELECT id, name FROM scenarios WHERE is_active AND chain_id = 31337",
  );
  if (!rows[0]) throw new Error("No active local scenario. Run npm run db:seed first.");
  const id = rows[0].id;
  for (const table of ["chain_events", "chain_txs", "indexer_state", "tx_requests", "projects", "funding_transfers"]) {
    await client.query(`DELETE FROM ${table} WHERE scenario_id = $1`, [id]);
  }
  await client.query(
    `UPDATE scenarios SET factory_address = NULL, marketplace_address = NULL, nft_address = NULL, start_block = NULL
      WHERE id = $1`,
    [id],
  );
  await client.query("COMMIT");
  console.log(`cleared chain data for local scenario #${id} "${rows[0].name}"; logins and settings kept`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
