// Read-only readiness check before deploying or running the role-play. Sends no transactions.
//
//   npx hardhat run scripts/preflight.ts --network sepolia     (or --network localhost)
//
// Checks chain and config agreement, the scenario in the database, organizer balances against
// the measured gas budget, per-role gas funding, and (after deployment) the contracts.
import { Contract, ZeroAddress, formatEther } from "ethers";
import { connect, getActiveScenario, openDb, sameAddress } from "./lib/common.js";
import { FEE_SAFETY, GAS, GAS_PER_ROLE } from "./lib/gas.js";

type Level = "PASS" | "WARN" | "FAIL";
const results: { level: Level; message: string }[] = [];
const report = (level: Level, message: string) => results.push({ level, message });

const { ethers, chainId, deployer, exchange1 } = await connect();
report("PASS", `connected to chain ${chainId}, matching NEXT_PUBLIC_CHAIN_ID`);
const db = await openDb();

try {
  const scenario = await getActiveScenario(db, chainId);
  report("PASS", `active scenario #${scenario.id} "${scenario.name}"`);

  // Participants and exchanges.
  const { rows: people } = await db.query<{ id: string; role: string; wallet_address: string; is_malicious: boolean }>(
    `SELECT p.id, p.role, p.wallet_address, coalesce(pp.is_malicious, FALSE) AS is_malicious
       FROM participants p LEFT JOIN participant_private pp ON pp.scenario_id = p.scenario_id AND pp.participant_id = p.id
      WHERE p.scenario_id = $1 ORDER BY p.id`,
    [scenario.id],
  );
  const count = (role: string) => people.filter((p) => p.role === role).length;
  const shape = `${count("creator")} creators, ${count("investor")} investors, ${count("mule")} mule`;
  report(count("creator") === 5 && count("investor") === 9 && count("mule") === 1 ? "PASS" : "WARN", shape);
  const malicious = people.filter((p) => p.is_malicious).map((p) => p.id);
  report(malicious.length === 1 ? "PASS" : "WARN", `malicious creator set: ${malicious.join(", ") || "none"}`);

  if (!sameAddress(scenario.exchange1_address, exchange1.address)) {
    report(
      "FAIL",
      `Exchange 1 signer ${exchange1.address} ≠ scenario Exchange 1 ${scenario.exchange1_address ?? "unset"}`,
    );
  } else report("PASS", `Exchange 1 signer matches the scenario (${exchange1.address})`);
  if (!scenario.exchange2_address) report("FAIL", "Exchange 2 is not set");
  else if (sameAddress(scenario.exchange2_address, exchange1.address))
    report("FAIL", "Exchange 1 and Exchange 2 are the same address");
  else report("PASS", `Exchange 2 set (${scenario.exchange2_address})`);
  if (
    people.some(
      (p) => sameAddress(p.wallet_address, deployer.address) || sameAddress(p.wallet_address, exchange1.address),
    )
  ) {
    report("FAIL", "a participant wallet is also the deployer or Exchange 1");
  }

  // Fees and budgets.
  const fees = await ethers.provider.getFeeData();
  const fee = fees.maxFeePerGas ?? fees.gasPrice ?? 0n;
  const budgetFee = fee * FEE_SAFETY;
  report(
    "PASS",
    `current max fee ${ethers.formatUnits(fee, "gwei")} gwei; budgeting at ${FEE_SAFETY}× = ${ethers.formatUnits(budgetFee, "gwei")} gwei`,
  );

  const deployed = Boolean(scenario.factory_address);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const deployerNeed = (deployed ? 0n : GAS.deployAll) * budgetFee + GAS.setCreatorAllowed * 5n * budgetFee;
  report(
    deployerBalance >= deployerNeed ? "PASS" : "FAIL",
    `deployer ${deployer.address} has ${formatEther(deployerBalance)} ETH, needs ~${formatEther(deployerNeed)} ETH${deployed ? " (contracts already deployed)" : ""}`,
  );

  const { rows: funding } = await db.query<{
    role: keyof typeof GAS_PER_ROLE;
    gas_wei: string;
    scenario_wei: string;
    unfunded: string;
  }>(
    `SELECT f.role, f.gas_wei::text, f.scenario_wei::text,
            (SELECT count(*) FROM participants p WHERE p.scenario_id = f.scenario_id AND p.role = f.role
               AND NOT EXISTS (SELECT 1 FROM funding_transfers t WHERE t.scenario_id = p.scenario_id
                                 AND lower(t.to_address) = lower(p.wallet_address) AND t.status = 'confirmed'))::text AS unfunded
       FROM funding_plan f WHERE f.scenario_id = $1`,
    [scenario.id],
  );
  let exchange1Need = 0n;
  for (const f of funding) {
    exchange1Need += (BigInt(f.gas_wei) + BigInt(f.scenario_wei) + GAS.transfer * budgetFee) * BigInt(f.unfunded);
    const needed = GAS_PER_ROLE[f.role] * budgetFee;
    report(
      BigInt(f.gas_wei) >= needed ? "PASS" : "WARN",
      `${f.role} gas funding ${formatEther(f.gas_wei)} ETH vs ~${formatEther(needed)} ETH expected gas at ${FEE_SAFETY}× fee`,
    );
  }
  const exchange1Balance = await ethers.provider.getBalance(exchange1.address);
  report(
    exchange1Balance >= exchange1Need ? "PASS" : "FAIL",
    `Exchange 1 has ${formatEther(exchange1Balance)} ETH, needs ~${formatEther(exchange1Need)} ETH for unfunded wallets`,
  );

  const investorPlan = funding.find((f) => f.role === "investor");
  if (investorPlan && BigInt(investorPlan.scenario_wei) < BigInt(scenario.min_mint_price_wei)) {
    report("WARN", "investor scenario funds are below the minimum mint price");
  }

  // Deployment state.
  if (!deployed) {
    const baseUri = process.env.NFT_BASE_URI ?? "http://localhost:3000/api/nft/";
    const localUri = /localhost|127\.0\.0\.1/.test(baseUri);
    report(chainId === 11155111 && localUri ? "FAIL" : "PASS", `NFT_BASE_URI for deploy: ${baseUri}`);
    report("WARN", "contracts not deployed yet");
  } else {
    for (const [name, address] of [
      ["ProjectFactory", scenario.factory_address],
      ["Marketplace", scenario.marketplace_address],
      ["ScenarioNFT", scenario.nft_address],
    ] as const) {
      const code = address ? await ethers.provider.getCode(address) : "0x";
      report(
        code !== "0x" ? "PASS" : "FAIL",
        `${name} ${address ?? "unset"} ${code !== "0x" ? "has code" : "has NO code on this chain"}`,
      );
    }
    const factory = new Contract(
      scenario.factory_address!,
      ["function isCreatorAllowed(address) view returns (bool)", "function marketplace() view returns (address)"],
      ethers.provider,
    );
    const allowed = await Promise.all(
      people.filter((p) => p.role === "creator").map((p) => factory.isCreatorAllowed(p.wallet_address)),
    );
    report(
      allowed.every(Boolean) ? "PASS" : "WARN",
      `${allowed.filter(Boolean).length}/${allowed.length} creators allowed on the factory`,
    );
    const wired = (await factory.marketplace()) as string;
    report(
      wired !== ZeroAddress && sameAddress(wired, scenario.marketplace_address!) ? "PASS" : "FAIL",
      "factory is wired to the scenario marketplace",
    );
  }
} finally {
  await db.end();
}

for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.message}`);
const failed = results.filter((r) => r.level === "FAIL").length;
console.log(failed ? `\n${failed} check(s) failed.` : "\nNo blocking problems found.");
if (failed) process.exitCode = 1;
