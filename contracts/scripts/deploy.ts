// Deploys ScenarioNFT, ProjectFactory, and Marketplace for the active scenario, wires them,
// writes deployments/<chainId>.json, and records the addresses in the scenario row.
//
//   npx hardhat run scripts/deploy.ts --network localhost
//
// Env: NFT_BASE_URI (default http://localhost:3000/api/nft/), REDEPLOY=1 to replace an existing deployment.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ContractTransactionResponse } from "ethers";
import { connect, deploymentFile, getActiveScenario, openDb } from "./lib/common.js";

const { ethers, chainId, deployer } = await connect();
const db = await openDb();

try {
  const scenario = await getActiveScenario(db, chainId);
  if (scenario.factory_address && process.env.REDEPLOY !== "1") {
    throw new Error(`Scenario "${scenario.name}" already has contracts. Set REDEPLOY=1 to deploy a new set.`);
  }
  const baseUri = process.env.NFT_BASE_URI ?? "http://localhost:3000/api/nft/";
  const minPrice = BigInt(scenario.min_mint_price_wei);
  const maxPrice = BigInt(scenario.max_mint_price_wei);

  console.log(`Deploying for "${scenario.name}" on chain ${chainId} from ${deployer.address}`);

  async function deploy(name: string, args: unknown[]) {
    const contract = await ethers.deployContract(name, args, deployer);
    const receipt = await contract.deploymentTransaction()!.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${name} deployment failed`);
    const address = await contract.getAddress();
    console.log(`  ${name.padEnd(15)} ${address}  (block ${receipt.blockNumber})`);
    return { contract, address, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }

  async function confirm(label: string, tx: Promise<ContractTransactionResponse>) {
    const receipt = await (await tx).wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${label} failed`);
    console.log(`  ${label} (tx ${receipt.hash})`);
  }

  const nft = await deploy("ScenarioNFT", [deployer.address, baseUri]);
  const factory = await deploy("ProjectFactory", [deployer.address, minPrice, maxPrice]);
  const marketplace = await deploy("Marketplace", [factory.address, nft.address]);

  const factoryContract = await ethers.getContractAt("ProjectFactory", factory.address, deployer);
  const nftContract = await ethers.getContractAt("ScenarioNFT", nft.address, deployer);
  await confirm("factory.setMarketplace", factoryContract.setMarketplace(marketplace.address));
  await confirm("nft.setMarketplace", nftContract.setMarketplace(marketplace.address));

  const deployment = {
    chainId,
    scenario: scenario.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    startBlock: nft.blockNumber,
    nftBaseUri: baseUri,
    mintPriceBoundsWei: { min: minPrice.toString(), max: maxPrice.toString() },
    contracts: {
      ScenarioNFT: { address: nft.address, txHash: nft.txHash, blockNumber: nft.blockNumber },
      ProjectFactory: { address: factory.address, txHash: factory.txHash, blockNumber: factory.blockNumber },
      Marketplace: { address: marketplace.address, txHash: marketplace.txHash, blockNumber: marketplace.blockNumber },
    },
  };
  const file = deploymentFile(chainId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(deployment, null, 2) + "\n");

  await db.query(
    `UPDATE scenarios SET factory_address = $2, marketplace_address = $3, nft_address = $4, start_block = $5
      WHERE id = $1`,
    [scenario.id, factory.address, marketplace.address, nft.address, nft.blockNumber],
  );
  console.log(`Wrote ${path.relative(process.cwd(), file)} and updated scenario #${scenario.id}.`);
} finally {
  await db.end();
}
