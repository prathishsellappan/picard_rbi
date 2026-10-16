import { Contract, parseEther } from "ethers";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { artifact, deployScenarioContracts, devAccounts, mined, rpc, signer } from "./chain-helpers";

const { indexToHead, indexOnce } = await import("@/indexer/core");
const { addressHistory, getLabels, txDetail, recentTxs } = await import("@/lib/explorer");
const { getParticipantProgress } = await import("@/lib/data/progress");
const { POST: syncIndex } = await import("@/app/api/organizer/index/route");
const { startSession } = await import("@/lib/session");
const { cookieJar } = await import("./helpers");

const PRICE = parseEther("0.01");
let db: pg.Client;
let sid: number;
let a: string[];
let project: string;
const hashes: Record<string, string> = {};

async function count(sql: string): Promise<number> {
  return Number((await db.query(sql, [sid])).rows[0].count);
}

beforeAll(async () => {
  a = await devAccounts();
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("TRUNCATE scenarios, organizers RESTART IDENTITY CASCADE");

  // 0 = Exchange 1, 1 = creator P01, 6 = investor P06, 15 = mule P15, 16 = Exchange 2, 17 = deployer.
  const { factory, marketplace, nft, startBlock } = await deployScenarioContracts(a[17], [a[1]]);
  sid = (
    await db.query<{ id: number }>(
      `INSERT INTO scenarios (name, chain_id, is_active, exchange1_address, exchange2_address,
                              factory_address, marketplace_address, nft_address, start_block)
       VALUES ('idx', 31337, TRUE, $1, $2, $3, $4, $5, $6) RETURNING id`,
      [a[0], a[16], await factory.getAddress(), await marketplace.getAddress(), await nft.getAddress(), startBlock],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash, username) VALUES
     ('P01', $1, 'C', 'creator', $2, 'x', 'creator1'), ('P06', $1, 'I', 'investor', $3, 'x', 'investor1'),
     ('P15', $1, 'M', 'mule', $4, 'x', 'mule')`,
    [sid, a[1], a[6], a[15]],
  );
  await db.query(
    `INSERT INTO known_addresses (scenario_id, address, public_label) VALUES
     ($1, $2, 'Exchange 1'), ($1, $3, 'P01'), ($1, $4, 'P06'), ($1, $5, 'P15'), ($1, $6, 'Exchange 2')`,
    [sid, a[0], a[1], a[6], a[15], a[16]],
  );

  // The whole money trail.
  const ex1 = await signer(a[0]);
  for (const to of [a[1], a[6], a[15]])
    hashes[`fund-${to}`] = await mined(ex1.sendTransaction({ to, value: parseEther("0.05") }));
  hashes.create = await mined(
    (factory.connect(await signer(a[1])) as Contract).createProject("Neon Ledger", PRICE, ""),
  );
  project = (await factory.projectOfCreator(a[1])) as string;
  hashes.mint = await mined((marketplace.connect(await signer(a[6])) as Contract).mint(project, { value: PRICE }));
  hashes.withdraw = await mined(new Contract(project, artifact("Project").abi, await signer(a[1])).withdraw(PRICE));
  hashes.toMule = await mined((await signer(a[1])).sendTransaction({ to: a[15], value: PRICE }));
  hashes.toEx2 = await mined((await signer(a[15])).sendTransaction({ to: a[16], value: PRICE }));
  // Activity between non-scenario accounts must not be indexed.
  hashes.unrelated = await mined((await signer(a[10])).sendTransaction({ to: a[11], value: 1n }));
});

afterAll(async () => {
  await db.end();
});

describe("indexer", () => {
  it("refuses to run before contracts are deployed", async () => {
    const other = (
      await db.query<{ id: number }>("INSERT INTO scenarios (name, chain_id) VALUES ('empty', 31337) RETURNING id")
    ).rows[0].id;
    await expect(indexOnce(db, rpc, other)).rejects.toThrow(/not deployed/);
  });

  it("indexes the whole money trail in small block ranges", async () => {
    const result = await indexToHead(db, rpc, sid, { maxBlocks: 3 });
    expect(result.upToDate).toBe(true);

    const methods = (await db.query("SELECT hash, method, status FROM chain_txs WHERE scenario_id = $1", [sid])).rows;
    const byHash = new Map(methods.map((r) => [r.hash, r]));
    expect(byHash.get(hashes.create)).toMatchObject({ method: "createProject", status: 1 });
    expect(byHash.get(hashes.mint)).toMatchObject({ method: "mint", status: 1 });
    expect(byHash.get(hashes.withdraw)).toMatchObject({ method: "withdraw", status: 1 });
    expect(byHash.get(hashes.toMule)).toMatchObject({ method: "transfer", status: 1 });
    expect(byHash.get(hashes.toEx2)).toMatchObject({ method: "transfer", status: 1 });
    for (const to of [a[1], a[6], a[15]]) expect(byHash.has(hashes[`fund-${to}`])).toBe(true);
    expect(byHash.has(hashes.unrelated)).toBe(false);
    // All three contract deployments, even the Marketplace whose constructor emits nothing.
    expect(methods.filter((r) => r.method === "contract creation")).toHaveLength(3);

    const events = (await db.query("SELECT event_name FROM chain_events WHERE scenario_id = $1", [sid])).rows.map(
      (r) => r.event_name,
    );
    for (const name of [
      "ProjectCreated",
      "PaymentRouted",
      "FundsReceived",
      "Withdrawn",
      "Transfer",
      "CreatorAllowed",
    ]) {
      expect(events).toContain(name);
    }
  });

  it("is idempotent and only moves forward", async () => {
    const before = await count("SELECT count(*) FROM chain_txs WHERE scenario_id = $1");
    const again = await indexOnce(db, rpc, sid);
    expect(again).toMatchObject({ upToDate: true, txs: 0, events: 0 });
    await db.query("UPDATE indexer_state SET last_block = last_block - 5 WHERE scenario_id = $1", [sid]);
    await indexToHead(db, rpc, sid);
    expect(await count("SELECT count(*) FROM chain_txs WHERE scenario_id = $1")).toBe(before);
  });
});

describe("explorer queries", () => {
  it("shows the mule's incoming and outgoing transfers", async () => {
    const h = await addressHistory(sid, a[15]);
    const incoming = h.txs.filter((t) => t.to === a[15]).map((t) => t.from);
    expect(incoming).toEqual(expect.arrayContaining([a[0], a[1]]));
    expect(h.txs.find((t) => t.hash === hashes.toEx2)).toMatchObject({ from: a[15], to: a[16] });
  });

  it("reconstructs internal ETH movements from events", async () => {
    const creator = await addressHistory(sid, a[1]);
    expect(creator.internal).toEqual([
      expect.objectContaining({ from: project, to: a[1], valueWei: PRICE.toString(), reason: "Project withdrawal" }),
    ]);
    const proj = await addressHistory(sid, project);
    expect(proj.internal.map((t) => t.reason).sort()).toEqual(["Mint payment routed to project", "Project withdrawal"]);
    const investor = await addressHistory(sid, a[6]);
    expect(investor.nftTransfers).toEqual([expect.objectContaining({ to: a[6], tokenId: "1" })]);
  });

  it("reads transaction detail live and decodes scenario events", async () => {
    const mint = await txDetail(sid, hashes.mint);
    expect(mint).toMatchObject({ status: "success", method: "mint", indexed: true, valueWei: PRICE.toString() });
    expect(mint!.events.map((e) => e.eventName)).toEqual(
      expect.arrayContaining(["Transfer", "FundsReceived", "PaymentRouted"]),
    );
    expect(mint!.internal).toEqual([expect.objectContaining({ to: project, valueWei: PRICE.toString() })]);

    const unrelated = await txDetail(sid, hashes.unrelated);
    expect(unrelated).toMatchObject({ indexed: false, method: "transfer", events: [] });
    expect(await txDetail(sid, `0x${"12".repeat(32)}`)).toBeNull();
  });

  it("labels addresses neutrally", async () => {
    const labels = await getLabels(sid);
    expect(labels.get(project.toLowerCase())).toBe("Project: Neon Ledger");
    expect(labels.get(a[16].toLowerCase())).toBe("Exchange 2");
    expect(labels.get(a[15].toLowerCase())).toBe("P15");
    expect([...labels.values()].join(" ")).not.toMatch(/mule|malicious|creator|investor/i);
    expect((await recentTxs(sid, 5)).length).toBe(5);
  });

  it("builds organizer progress from the index", async () => {
    const progress = Object.fromEntries((await getParticipantProgress(sid)).map((p) => [p.id, p]));
    expect(progress.P01).toMatchObject({
      funded: true,
      projectCreated: true,
      withdrawnWei: PRICE.toString(),
      sentWei: PRICE.toString(),
    });
    expect(progress.P06).toMatchObject({ funded: true, mints: 1 });
    expect(progress.P15).toMatchObject({ funded: true, receivedWei: PRICE.toString(), sentWei: PRICE.toString() });
  });
});

describe("organizer sync endpoint", () => {
  it("is organizer-only", async () => {
    cookieJar.clear();
    expect((await syncIndex()).status).toBe(401);
    await startSession({ scenarioId: sid, participantId: "P06" });
    expect((await syncIndex()).status).toBe(403);
    cookieJar.clear();
  });
});
