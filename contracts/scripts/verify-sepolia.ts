// Verifies the scenario contracts' source on Etherscan, using deployments/11155111.json and the
// ProjectCreated events (for the factory-deployed projects). Safe to re-run.
//
//   npx hardhat run --build-profile production scripts/verify-sepolia.ts --network sepolia
//
// Must use the same build profile as the deployment (production), or the bytecode won't match.
import { readFile } from "node:fs/promises";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";
import hre from "hardhat";
import { connect, deploymentFile } from "./lib/common.js";

const { ethers, chainId } = await connect();
if (chainId !== 11155111) throw new Error("verify-sepolia only runs on Sepolia (11155111).");

const deployment = JSON.parse(await readFile(deploymentFile(chainId), "utf8"));
const { ScenarioNFT, ProjectFactory, Marketplace } = deployment.contracts;

const targets: { name: string; address: string; constructorArgs: unknown[]; contract: string }[] = [
  {
    name: "ScenarioNFT",
    address: ScenarioNFT.address,
    constructorArgs: [deployment.deployer, deployment.nftBaseUri],
    contract: "contracts/ScenarioNFT.sol:ScenarioNFT",
  },
  {
    name: "ProjectFactory",
    address: ProjectFactory.address,
    constructorArgs: [deployment.deployer, deployment.mintPriceBoundsWei.min, deployment.mintPriceBoundsWei.max],
    contract: "contracts/ProjectFactory.sol:ProjectFactory",
  },
  {
    name: "Marketplace",
    address: Marketplace.address,
    constructorArgs: [ProjectFactory.address, ScenarioNFT.address],
    contract: "contracts/Marketplace.sol:Marketplace",
  },
];

// Projects are created by the factory; their constructor args come from ProjectCreated.
const factory = await ethers.getContractAt("ProjectFactory", ProjectFactory.address);
for (const event of await factory.queryFilter(factory.filters.ProjectCreated(), deployment.startBlock)) {
  const { projectId, project, creator, name, mintPrice, metadataURI } = event.args;
  targets.push({
    name: `Project #${projectId} (${name})`,
    address: project,
    constructorArgs: [projectId, creator, Marketplace.address, name, mintPrice, metadataURI],
    contract: "contracts/Project.sol:Project",
  });
}

let failures = 0;
for (const t of targets) {
  try {
    await verifyContract(
      { address: t.address, constructorArgs: t.constructorArgs, contract: t.contract, provider: "etherscan" },
      hre,
    );
    console.log(`verified ${t.name} ${t.address}`);
  } catch (error) {
    const message = (error as Error).message;
    if (/already verified/i.test(message)) console.log(`already verified ${t.name} ${t.address}`);
    else {
      failures++;
      console.error(`FAILED ${t.name} ${t.address}: ${message}`);
    }
  }
}
if (failures) process.exitCode = 1;
