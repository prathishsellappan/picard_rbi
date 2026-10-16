import { JsonRpcProvider, getAddress, parseEther, type JsonRpcSigner } from "ethers";
import pg from "pg";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ParticipantUser } from "@/lib/roles";
import { cookieJar } from "./helpers";

const { verifyAndRecordTx, checkTxRules, listOwnTxs, TxVerificationError } = await import("@/lib/tx-verify");
const { POST, GET } = await import("@/app/api/tx/route");
const { startSession } = await import("@/lib/session");
const { hashPassword } = await import("@/lib/password");

// Talks to the throwaway Hardhat node from global-setup. Its dev accounts are unlocked, which
// stands in for MetaMask signing.
const rpc = new JsonRpcProvider(process.env.RPC_URL, 31337, { staticNetwork: true });
let accounts: string[];
let signer: (i: number) => Promise<JsonRpcSigner>;
let creator: ParticipantUser;
let mule: ParticipantUser;
let exchange2: string;

async function send(from: number, to: string, value = parseEther("0.01"), data?: string) {
  const tx = await (await signer(from)).sendTransaction({ to, value, data });
  await tx.wait();
  return tx.hash;
}

function post(body: unknown) {
  return POST(new Request("http://test/api/tx", { method: "POST", body: JSON.stringify(body) }));
}

beforeAll(async () => {
  accounts = ((await rpc.send("eth_accounts", [])) as string[]).map((a) => getAddress(a));
  signer = (i) => rpc.getSigner(accounts[i]);
  exchange2 = accounts[16];

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("TRUNCATE scenarios, organizers RESTART IDENTITY CASCADE");
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO scenarios (name, chain_id, is_active, exchange2_address) VALUES ('tx', 31337, TRUE, $1) RETURNING id",
    [exchange2],
  );
  const sid = rows[0].id;
  const pw = await hashPassword("x");
  await db.query(
    `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash)
     VALUES ('P01', $1, 'C', 'creator', $2, $4), ('P15', $1, 'M', 'mule', $3, $4)`,
    [sid, accounts[1], accounts[15], pw],
  );
  await db.query("INSERT INTO organizers (username, password_hash) VALUES ('organizer', $1)", [pw]);
  await db.end();

  creator = {
    kind: "participant",
    scenarioId: sid,
    participantId: "P01",
    displayName: "C",
    role: "creator",
    walletAddress: accounts[1],
  };
  mule = {
    kind: "participant",
    scenarioId: sid,
    participantId: "P15",
    displayName: "M",
    role: "mule",
    walletAddress: accounts[15],
  };
});

beforeEach(() => cookieJar.clear());

describe("server-side transaction verification", () => {
  it("confirms a creator's transfer from the chain and records it", async () => {
    const hash = await send(1, accounts[5]);
    const result = await verifyAndRecordTx(creator, "transfer", hash);
    expect(result).toMatchObject({ status: "confirmed", to: accounts[5], valueWei: parseEther("0.01").toString() });
    expect(result.blockNumber).toBeGreaterThan(0);

    const rows = await listOwnTxs(creator);
    expect(rows.find((r) => r.tx_hash === hash)).toMatchObject({ status: "confirmed", kind: "transfer" });
  });

  it("rejects a transaction sent from someone else's wallet", async () => {
    const hash = await send(3, accounts[5]);
    await expect(verifyAndRecordTx(creator, "transfer", hash)).rejects.toMatchObject({
      status: 403,
      message: "This transaction was not sent from your assigned wallet.",
    });
  });

  it("rejects a kind that doesn't belong to the participant's role", async () => {
    const hash = await send(15, exchange2);
    await expect(verifyAndRecordTx(mule, "transfer", hash)).rejects.toMatchObject({ status: 403 });
  });

  it("only accepts mule transfers that go to Exchange 2", async () => {
    const wrong = await send(15, accounts[5]);
    await expect(verifyAndRecordTx(mule, "mule_transfer", wrong)).rejects.toThrow("not sent to Exchange 2");

    const right = await send(15, exchange2);
    await expect(verifyAndRecordTx(mule, "mule_transfer", right)).resolves.toMatchObject({ status: "confirmed" });
  });

  it("rejects transactions that are not plain ETH transfers", async () => {
    const hash = await send(1, accounts[5], parseEther("0.01"), "0x1234");
    await expect(verifyAndRecordTx(creator, "transfer", hash)).rejects.toThrow("Expected a plain ETH transfer.");
  });

  it("reports unknown hashes as not found", async () => {
    await expect(verifyAndRecordTx(creator, "transfer", `0x${"ab".repeat(32)}`)).rejects.toMatchObject({ status: 404 });
  });

  it("records a pending transaction, then confirms it once mined", async () => {
    await rpc.send("evm_setAutomine", [false]);
    try {
      const tx = await (await signer(1)).sendTransaction({ to: accounts[6], value: parseEther("0.001") });
      expect(await verifyAndRecordTx(creator, "transfer", tx.hash)).toMatchObject({
        status: "pending",
        blockNumber: null,
      });
      await rpc.send("evm_mine", []);
      expect(await verifyAndRecordTx(creator, "transfer", tx.hash)).toMatchObject({ status: "confirmed" });
    } finally {
      await rpc.send("evm_setAutomine", [true]);
    }
  });

  it("checks rules without a network (unit)", () => {
    const base = { from: accounts[1], to: accounts[2], data: "0x", value: 1n };
    expect(() =>
      checkTxRules(base, "transfer", creator, { exchange2Address: exchange2, contracts: null, creatorProject: null }),
    ).not.toThrow();
    expect(() =>
      checkTxRules({ ...base, value: 0n }, "transfer", creator, {
        exchange2Address: exchange2,
        contracts: null,
        creatorProject: null,
      }),
    ).toThrow(TxVerificationError);
    expect(() =>
      checkTxRules({ ...base, to: null }, "transfer", creator, {
        exchange2Address: exchange2,
        contracts: null,
        creatorProject: null,
      }),
    ).toThrow(TxVerificationError);
    expect(() =>
      checkTxRules({ ...base, from: accounts[15], to: exchange2 }, "mule_transfer", mule, {
        exchange2Address: null,
        contracts: null,
        creatorProject: null,
      }),
    ).toThrow("Exchange 2 is not configured.");
  });
});

describe("/api/tx", () => {
  it("requires a participant session", async () => {
    expect((await post({ kind: "transfer", txHash: `0x${"00".repeat(32)}` })).status).toBe(401);
    expect((await GET()).status).toBe(401);

    await startSession({ organizerId: 1 });
    expect((await post({ kind: "transfer", txHash: `0x${"00".repeat(32)}` })).status).toBe(403);
  });

  it("validates the body", async () => {
    await startSession({ scenarioId: creator.scenarioId, participantId: "P01" });
    expect((await post({ kind: "transfer", txHash: "0x123" })).status).toBe(400);
    expect((await post({ kind: "steal", txHash: `0x${"00".repeat(32)}` })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
  });

  it("verifies and lists the caller's own transactions only", async () => {
    const hash = await send(1, accounts[7]);
    await startSession({ scenarioId: creator.scenarioId, participantId: "P01" });
    const res = await post({ kind: "transfer", txHash: hash });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "confirmed" });

    cookieJar.clear();
    await startSession({ scenarioId: mule.scenarioId, participantId: "P15" });
    const muleRows = (await (await GET()).json()) as { tx_hash: string }[];
    expect(muleRows.some((r) => r.tx_hash === hash)).toBe(false);
    // The mule can't claim the creator's transaction either.
    expect((await post({ kind: "mule_transfer", txHash: hash })).status).toBe(403);
  });
});
