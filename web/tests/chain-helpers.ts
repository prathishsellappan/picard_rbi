import { readFileSync } from "node:fs";
import path from "node:path";
import { Contract, ContractFactory, JsonRpcProvider, getAddress, parseEther, type JsonRpcSigner } from "ethers";

// Helpers for tests that use the throwaway Hardhat node from global-setup.

export const rpc = new JsonRpcProvider(process.env.RPC_URL, 31337, { staticNetwork: true, cacheTimeout: -1 });

export async function devAccounts(): Promise<string[]> {
  return ((await rpc.send("eth_accounts", [])) as string[]).map((a) => getAddress(a));
}

export const signer = (address: string): Promise<JsonRpcSigner> => rpc.getSigner(address);

export function artifact(name: string) {
  const file = path.join(
    import.meta.dirname,
    "..",
    "..",
    "contracts",
    "artifacts",
    "contracts",
    `${name}.sol`,
    `${name}.json`,
  );
  return JSON.parse(readFileSync(file, "utf8")) as { abi: object[]; bytecode: string };
}

export async function deploy(name: string, from: JsonRpcSigner, args: unknown[]) {
  const { abi, bytecode } = artifact(name);
  const contract = await new ContractFactory(abi, bytecode, from).deploy(...args);
  await contract.waitForDeployment();
  return contract as Contract;
}

// Deploys and wires the scenario contracts like contracts/scripts/deploy.ts.
export async function deployScenarioContracts(deployerAddress: string, creators: string[]) {
  const deployer = await signer(deployerAddress);
  const nft = await deploy("ScenarioNFT", deployer, [deployerAddress, "http://localhost:3000/api/nft/"]);
  const startBlock = (await nft.deploymentTransaction()!.wait())!.blockNumber;
  const factory = await deploy("ProjectFactory", deployer, [deployerAddress, parseEther("0.005"), parseEther("0.02")]);
  const marketplace = await deploy("Marketplace", deployer, [await factory.getAddress(), await nft.getAddress()]);
  await (await factory.setMarketplace(await marketplace.getAddress())).wait();
  await (await nft.setMarketplace(await marketplace.getAddress())).wait();
  for (const creator of creators) await (await factory.setCreatorAllowed(creator, true)).wait();
  return { nft, factory, marketplace, startBlock };
}

export async function mined(tx: Promise<{ hash: string; wait(): Promise<unknown> }>): Promise<string> {
  const sent = await tx;
  await sent.wait();
  return sent.hash;
}
