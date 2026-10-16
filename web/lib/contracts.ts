import "server-only";
import { Contract, ZeroAddress, getAddress } from "ethers";
import { ABI } from "./abi";
import { getProvider } from "./chain";
import { query, queryOne } from "./db";

// Server-side reads of confirmed on-chain state. Contract addresses come from the scenario
// (written by the deploy script); the values shown to participants come from the chain.

export type ScenarioContracts = { factory: string; marketplace: string; nft: string };

export class ContractsNotReadyError extends Error {
  constructor(message = "The scenario contracts are not deployed yet. Ask the organizer.") {
    super(message);
  }
}

const verifiedCode = new Set<string>();

async function assertHasCode(address: string, name: string) {
  if (verifiedCode.has(address)) return;
  const code = await (await getProvider()).getCode(address);
  if (code === "0x") throw new ContractsNotReadyError(`No ${name} contract found at ${address} on this chain.`);
  verifiedCode.add(address);
}

export async function getScenarioContracts(scenarioId: number): Promise<ScenarioContracts> {
  const row = await queryOne<{
    factory_address: string | null;
    marketplace_address: string | null;
    nft_address: string | null;
  }>("SELECT factory_address, marketplace_address, nft_address FROM scenarios WHERE id = $1", [scenarioId]);
  if (!row?.factory_address || !row.marketplace_address || !row.nft_address) throw new ContractsNotReadyError();
  const contracts = {
    factory: getAddress(row.factory_address),
    marketplace: getAddress(row.marketplace_address),
    nft: getAddress(row.nft_address),
  };
  await Promise.all([
    assertHasCode(contracts.factory, "ProjectFactory"),
    assertHasCode(contracts.marketplace, "Marketplace"),
    assertHasCode(contracts.nft, "ScenarioNFT"),
  ]);
  return contracts;
}

async function contract(address: string, abi: keyof typeof ABI) {
  return new Contract(address, ABI[abi], await getProvider());
}

// Values are strings so they can be passed to Client Components.
export type ProjectInfo = {
  address: string;
  projectId: number;
  name: string;
  creator: string;
  mintPriceWei: string;
  totalReceivedWei: string;
  totalWithdrawnWei: string;
  availableWei: string;
  mintedCount: number;
  description: string;
};

async function readProject(address: string, descriptions: Map<string, string>): Promise<ProjectInfo> {
  const p = await contract(address, "Project");
  const [projectId, name, creator, mintPrice, totalReceived, totalWithdrawn] = await Promise.all([
    p.projectId() as Promise<bigint>,
    p.name() as Promise<string>,
    p.creator() as Promise<string>,
    p.mintPrice() as Promise<bigint>,
    p.totalReceived() as Promise<bigint>,
    p.totalWithdrawn() as Promise<bigint>,
  ]);
  return {
    address,
    projectId: Number(projectId),
    name,
    creator,
    mintPriceWei: mintPrice.toString(),
    totalReceivedWei: totalReceived.toString(),
    totalWithdrawnWei: totalWithdrawn.toString(),
    availableWei: (totalReceived - totalWithdrawn).toString(),
    // Every deposit is exactly the mint price, so this is the number of mints.
    mintedCount: Number(totalReceived / mintPrice),
    description: descriptions.get(address.toLowerCase()) ?? "",
  };
}

// Off-chain descriptions keyed by contract address. Only used for display.
async function projectDescriptions(scenarioId: number): Promise<Map<string, string>> {
  const rows = await query<{ contract_address: string; description: string }>(
    "SELECT contract_address, description FROM projects WHERE scenario_id = $1 AND contract_address IS NOT NULL",
    [scenarioId],
  );
  return new Map(rows.map((r) => [r.contract_address.toLowerCase(), r.description]));
}

// All projects registered in the factory — the chain decides what exists, not the database.
export async function listProjects(scenarioId: number, c: ScenarioContracts): Promise<ProjectInfo[]> {
  const factory = await contract(c.factory, "ProjectFactory");
  const [addresses, descriptions] = await Promise.all([
    factory.getProjects() as Promise<string[]>,
    projectDescriptions(scenarioId),
  ]);
  return Promise.all(addresses.map((a) => readProject(a, descriptions)));
}

export async function getProjectOfCreator(
  scenarioId: number,
  c: ScenarioContracts,
  creator: string,
): Promise<ProjectInfo | null> {
  const factory = await contract(c.factory, "ProjectFactory");
  const address = (await factory.projectOfCreator(creator)) as string;
  if (address === ZeroAddress) return null;
  return readProject(address, await projectDescriptions(scenarioId));
}

export async function getCreatorAllowed(c: ScenarioContracts, creator: string): Promise<boolean> {
  return (await contract(c.factory, "ProjectFactory")).isCreatorAllowed(creator) as Promise<boolean>;
}

export async function getMintPriceBounds(c: ScenarioContracts): Promise<{ minWei: string; maxWei: string }> {
  const factory = await contract(c.factory, "ProjectFactory");
  const [min, max] = await Promise.all([
    factory.minMintPrice() as Promise<bigint>,
    factory.maxMintPrice() as Promise<bigint>,
  ]);
  return { minWei: min.toString(), maxWei: max.toString() };
}

export type OwnedNft = { tokenId: number; project: string };

// The role-play mints at most a few dozen tokens, so scanning every token ID is simple and exact.
export async function listOwnedNfts(c: ScenarioContracts, owner: string): Promise<OwnedNft[]> {
  const nft = await contract(c.nft, "ScenarioNFT");
  const total = Number((await nft.totalMinted()) as bigint);
  const ids = Array.from({ length: total }, (_, i) => i + 1);
  const owners = await Promise.all(ids.map((id) => nft.ownerOf(id) as Promise<string>));
  const mine = ids.filter((_, i) => owners[i].toLowerCase() === owner.toLowerCase());
  const projects = await Promise.all(mine.map((id) => nft.projectOf(id) as Promise<string>));
  return mine.map((tokenId, i) => ({ tokenId, project: projects[i] }));
}

export async function getNftToken(c: ScenarioContracts, tokenId: number): Promise<{ project: string } | null> {
  const nft = await contract(c.nft, "ScenarioNFT");
  if (tokenId < 1 || tokenId > Number((await nft.totalMinted()) as bigint)) return null;
  return { project: (await nft.projectOf(tokenId)) as string };
}
