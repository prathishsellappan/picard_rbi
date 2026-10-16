import { network } from "hardhat";

export const connection = await network.create();
export const { ethers, networkHelpers } = connection;

export const MIN_PRICE = ethers.parseEther("0.005");
export const MAX_PRICE = ethers.parseEther("0.02");
export const PRICE = ethers.parseEther("0.01");

// Deploys and wires the contracts the same way scripts/deploy.ts does.
export async function deployScenario() {
  const [organizer, creatorA, creatorB, investor1, investor2, mule, exchange1, exchange2, outsider] =
    await ethers.getSigners();

  const nft = await ethers.deployContract("ScenarioNFT", [organizer.address, "http://localhost:3000/api/nft/"]);
  const factory = await ethers.deployContract("ProjectFactory", [organizer.address, MIN_PRICE, MAX_PRICE]);
  const marketplace = await ethers.deployContract("Marketplace", [await factory.getAddress(), await nft.getAddress()]);
  await factory.setMarketplace(await marketplace.getAddress());
  await nft.setMarketplace(await marketplace.getAddress());
  await factory.setCreatorAllowed(creatorA.address, true);
  await factory.setCreatorAllowed(creatorB.address, true);

  return {
    nft,
    factory,
    marketplace,
    organizer,
    creatorA,
    creatorB,
    investor1,
    investor2,
    mule,
    exchange1,
    exchange2,
    outsider,
  };
}

// Scenario plus one project per allowed creator.
export async function deployWithProjects() {
  const base = await deployScenario();
  await base.factory.connect(base.creatorA).createProject("Aurora Pixels", PRICE, "ipfs://a");
  await base.factory.connect(base.creatorB).createProject("Neon Ledger", MAX_PRICE, "ipfs://b");
  const projectA = await ethers.getContractAt("Project", await base.factory.projectOfCreator(base.creatorA.address));
  const projectB = await ethers.getContractAt("Project", await base.factory.projectOfCreator(base.creatorB.address));
  return { ...base, projectA, projectB };
}
