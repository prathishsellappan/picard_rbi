import { Contract, parseEther } from "ethers";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ParticipantUser } from "@/lib/roles";
import { artifact, deploy, devAccounts, signer } from "./chain-helpers";

const { verifyAndRecordTx, checkTxRules } = await import("@/lib/tx-verify");
const { getScenarioContracts, listProjects, getProjectOfCreator, listOwnedNfts, ContractsNotReadyError } = await import(
  "@/lib/contracts"
);
const { GET: getNftMetadata } = await import("@/app/api/nft/[id]/route");

// Deploys the real compiled contracts to the throwaway Hardhat node from global-setup and runs
// the Stage 5 flows through the server's verification code.
const PRICE = parseEther("0.01");

let db: pg.Client;
let accounts: string[];
let sid: number;
let creatorA: ParticipantUser;
let creatorB: ParticipantUser;
let investor: ParticipantUser;
let factory: Contract;
let marketplace: Contract;
let nft: Contract;

const user = (id: string, role: ParticipantUser["role"], wallet: string): ParticipantUser => ({
  kind: "participant",
  scenarioId: sid,
  participantId: id,
  username: id.toLowerCase(),
  displayName: id,
  role,
  walletAddress: wallet,
});

async function hashOf(tx: Promise<{ hash: string; wait(): Promise<unknown> }>) {
  const sent = await tx;
  await sent.wait();
  return sent.hash;
}

beforeAll(async () => {
  accounts = await devAccounts();
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("TRUNCATE scenarios, organizers RESTART IDENTITY CASCADE");
  sid = (
    await db.query<{ id: number }>(
      "INSERT INTO scenarios (name, chain_id, is_active, exchange2_address) VALUES ('flow', 31337, TRUE, $1) RETURNING id",
      [accounts[16]],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash, username) VALUES
     ('P01', $1, 'A', 'creator', $2, 'x', 'creator1'), ('P02', $1, 'B', 'creator', $3, 'x', 'creator2'),
     ('P06', $1, 'I', 'investor', $4, 'x', 'investor1')`,
    [sid, accounts[1], accounts[2], accounts[6]],
  );
  creatorA = user("P01", "creator", accounts[1]);
  creatorB = user("P02", "creator", accounts[2]);
  investor = user("P06", "investor", accounts[6]);
});

afterAll(async () => {
  await db.end();
});

describe("before deployment", () => {
  it("reports missing contracts instead of guessing", async () => {
    await expect(getScenarioContracts(sid)).rejects.toBeInstanceOf(ContractsNotReadyError);
  });

  it("rejects addresses that have no contract code", async () => {
    await db.query(
      "UPDATE scenarios SET factory_address = $2, marketplace_address = $2, nft_address = $2 WHERE id = $1",
      [sid, accounts[9]],
    );
    await expect(getScenarioContracts(sid)).rejects.toThrow(/No ProjectFactory contract found/);
  });
});

describe("Stage 5 flows", () => {
  beforeAll(async () => {
    const deployer = await signer(accounts[17]);
    nft = await deploy("ScenarioNFT", deployer, [accounts[17], "http://localhost:3000/api/nft/"]);
    factory = await deploy("ProjectFactory", deployer, [accounts[17], parseEther("0.005"), parseEther("0.02")]);
    marketplace = await deploy("Marketplace", deployer, [await factory.getAddress(), await nft.getAddress()]);
    await (await factory.setMarketplace(await marketplace.getAddress())).wait();
    await (await nft.setMarketplace(await marketplace.getAddress())).wait();
    await (await factory.setCreatorAllowed(accounts[1], true)).wait();
    await (await factory.setCreatorAllowed(accounts[2], true)).wait();
    await db.query(
      "UPDATE scenarios SET factory_address = $2, marketplace_address = $3, nft_address = $4 WHERE id = $1",
      [sid, await factory.getAddress(), await marketplace.getAddress(), await nft.getAddress()],
    );
  });

  it("records a created project with its off-chain description", async () => {
    const asA = factory.connect(await signer(accounts[1])) as Contract;
    const hash = await hashOf(asA.createProject("Aurora Pixels", PRICE, ""));
    const result = await verifyAndRecordTx(creatorA, "create_project", hash, { description: "Skyline art" });
    expect(result.status).toBe("confirmed");

    const { rows } = await db.query(
      "SELECT name, description, mint_price_wei::text, status FROM projects WHERE creator_id = 'P01'",
    );
    expect(rows[0]).toEqual({
      name: "Aurora Pixels",
      description: "Skyline art",
      mint_price_wei: PRICE.toString(),
      status: "confirmed",
    });

    const contracts = await getScenarioContracts(sid);
    const project = await getProjectOfCreator(sid, contracts, accounts[1]);
    expect(project).toMatchObject({
      name: "Aurora Pixels",
      creator: accounts[1],
      mintedCount: 0,
      description: "Skyline art",
    });
  });

  it("lists projects from the factory even without a database row", async () => {
    const asB = factory.connect(await signer(accounts[2])) as Contract;
    await hashOf(asB.createProject("Neon Ledger", parseEther("0.02"), "")); // never reported to the app
    const projects = await listProjects(sid, await getScenarioContracts(sid));
    expect(projects.map((p) => p.name)).toEqual(["Aurora Pixels", "Neon Ledger"]);
    expect(projects[1].description).toBe("");
  });

  it("rejects a createProject call that wasn't sent to the factory", async () => {
    const data = factory.interface.encodeFunctionData("createProject", ["X", PRICE, ""]);
    const hash = await hashOf((await signer(accounts[1])).sendTransaction({ to: accounts[5], data }));
    await expect(verifyAndRecordTx(creatorA, "create_project", hash)).rejects.toThrow(
      "Expected a createProject() call to the project factory.",
    );
  });

  it("verifies an investor's mint and shows the NFT and project funds from the chain", async () => {
    const contracts = await getScenarioContracts(sid);
    const projectA = (await getProjectOfCreator(sid, contracts, accounts[1]))!;
    const asInvestor = marketplace.connect(await signer(accounts[6])) as Contract;
    const hash = await hashOf(asInvestor.mint(projectA.address, { value: PRICE }));

    expect(await verifyAndRecordTx(investor, "mint", hash)).toMatchObject({
      status: "confirmed",
      valueWei: PRICE.toString(),
    });
    expect(await listOwnedNfts(contracts, accounts[6])).toEqual([{ tokenId: 1, project: projectA.address }]);
    expect(await getProjectOfCreator(sid, contracts, accounts[1])).toMatchObject({
      mintedCount: 1,
      totalReceivedWei: PRICE.toString(),
      availableWei: PRICE.toString(),
    });
    // A creator can't claim an investor's mint, and creators can't report mints at all.
    await expect(verifyAndRecordTx(creatorA, "mint", hash)).rejects.toMatchObject({ status: 403 });
  });

  it("serves public NFT metadata", async () => {
    const res = await getNftMetadata(new Request("http://test/api/nft/1"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Aurora Pixels #1", description: "Skyline art" });
    const missing = await getNftMetadata(new Request("http://test"), { params: Promise.resolve({ id: "99" }) });
    expect(missing.status).toBe(404);
    const bad = await getNftMetadata(new Request("http://test"), { params: Promise.resolve({ id: "abc" }) });
    expect(bad.status).toBe(400);
  });

  it("verifies a creator's withdrawal from their own project", async () => {
    const contracts = await getScenarioContracts(sid);
    const projectA = (await getProjectOfCreator(sid, contracts, accounts[1]))!;
    const project = new Contract(projectA.address, artifact("Project").abi, await signer(accounts[1]));
    const hash = await hashOf(project.withdraw(PRICE));

    expect(await verifyAndRecordTx(creatorA, "withdraw", hash)).toMatchObject({ status: "confirmed" });
    expect(await getProjectOfCreator(sid, contracts, accounts[1])).toMatchObject({
      totalWithdrawnWei: PRICE.toString(),
      availableWei: "0",
    });
  });

  it("only accepts withdraw() calls to the reporting creator's own project", async () => {
    const contracts = await getScenarioContracts(sid);
    const projectA = (await getProjectOfCreator(sid, contracts, accounts[1]))!;
    const projectB = (await getProjectOfCreator(sid, contracts, accounts[2]))!;
    const data = new Contract(projectA.address, artifact("Project").abi).interface.encodeFunctionData("withdraw", [1n]);
    const tx = { from: accounts[1], to: projectB.address, data, value: 0n };
    const ctx = { exchange2Address: null, contracts, creatorProject: projectA.address };

    expect(() => checkTxRules(tx, "withdraw", creatorA, ctx)).toThrow("Expected a withdraw() call to your project.");
    expect(() => checkTxRules({ ...tx, to: projectA.address }, "withdraw", creatorA, ctx)).not.toThrow();
    expect(() =>
      checkTxRules({ ...tx, from: accounts[2] }, "withdraw", creatorB, { ...ctx, creatorProject: null }),
    ).toThrow("your project is not available yet.");
  });
});
