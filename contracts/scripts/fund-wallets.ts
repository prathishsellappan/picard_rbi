// Exchange 1 sends each participant wallet its initial test ETH: one transfer per wallet of
// (gas funding + scenario funds) from the scenario's funding plan. Each transfer is recorded in
// funding_transfers and only marked confirmed after its receipt succeeds.
// Safe to re-run: wallets with a confirmed transfer for this scenario are skipped.
//
//   npx hardhat run scripts/fund-wallets.ts --network localhost
import { connect, getActiveScenario, openDb, sameAddress } from "./lib/common.js";

const { ethers, chainId, exchange1 } = await connect();
const db = await openDb();

try {
  const scenario = await getActiveScenario(db, chainId);
  if (!sameAddress(scenario.exchange1_address, exchange1.address)) {
    throw new Error(
      `Signer ${exchange1.address} is not this scenario's Exchange 1 (${scenario.exchange1_address ?? "unset"}).`,
    );
  }

  const { rows: wallets } = await db.query<{
    id: string;
    wallet_address: string;
    gas_wei: string;
    scenario_wei: string;
  }>(
    `SELECT p.id, p.wallet_address, f.gas_wei::text, f.scenario_wei::text
       FROM participants p JOIN funding_plan f ON f.scenario_id = p.scenario_id AND f.role = p.role
      WHERE p.scenario_id = $1
        AND NOT EXISTS (SELECT 1 FROM funding_transfers t
                         WHERE t.scenario_id = p.scenario_id AND lower(t.to_address) = lower(p.wallet_address)
                           AND t.status = 'confirmed')
      ORDER BY p.id`,
    [scenario.id],
  );
  if (wallets.length === 0) {
    console.log("Every participant wallet already has a confirmed funding transfer.");
  }

  const total = wallets.reduce((sum, w) => sum + BigInt(w.gas_wei) + BigInt(w.scenario_wei), 0n);
  const balance = await ethers.provider.getBalance(exchange1.address);
  if (balance < total) {
    throw new Error(
      `Exchange 1 holds ${ethers.formatEther(balance)} ETH but needs ${ethers.formatEther(total)} ETH plus gas.`,
    );
  }
  if (wallets.length > 0) {
    console.log(
      `Funding ${wallets.length} wallets with ${ethers.formatEther(total)} ETH from Exchange 1 ${exchange1.address}`,
    );
  }

  for (const w of wallets) {
    const gas = BigInt(w.gas_wei);
    const scenarioFunds = BigInt(w.scenario_wei);
    const value = gas + scenarioFunds;
    if (value === 0n) continue;

    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO funding_transfers (scenario_id, to_address, gas_wei, scenario_wei, status)
       VALUES ($1, $2, $3, $4, 'requested') RETURNING id`,
      [scenario.id, w.wallet_address, gas.toString(), scenarioFunds.toString()],
    );
    const recordId = rows[0].id;

    try {
      const tx = await exchange1.sendTransaction({ to: w.wallet_address, value });
      await db.query("UPDATE funding_transfers SET tx_hash = $2, status = 'pending' WHERE id = $1", [
        recordId,
        tx.hash,
      ]);
      const receipt = await tx.wait();
      const status = receipt && receipt.status === 1 ? "confirmed" : "failed";
      await db.query("UPDATE funding_transfers SET status = $2 WHERE id = $1", [recordId, status]);
      console.log(`  ${w.id} ${w.wallet_address} ${ethers.formatEther(value)} ETH ${status} (tx ${tx.hash})`);
      if (status === "failed") throw new Error(`Funding transfer to ${w.id} failed on-chain.`);
    } catch (error) {
      await db.query("UPDATE funding_transfers SET status = 'failed' WHERE id = $1 AND status <> 'confirmed'", [
        recordId,
      ]);
      throw error;
    }
  }
} finally {
  await db.end();
}
