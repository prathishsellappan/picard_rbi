// Stage 7: end-to-end simulation of the whole role-play on a fresh chain state.
//
//   provision (15 fresh zero-balance wallets + Exchange 2)  → real organizer scripts:
//   deploy → register creators → Exchange 1 funds all 15 → 5 projects → 18 mints by 9 investors
//   → an honest partial withdrawal → the malicious creator withdraws everything → mule → Exchange 2
//
// Every participant action goes through the server's verification (verifyAndRecordTx). The
// evidence is then checked only from the chain and the public index, the way the future
// investigation app will see it.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Contract, Wallet, ZeroAddress, formatEther, parseEther } from "ethers";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ParticipantUser } from "@/lib/roles";
import { artifact, devAccounts, rpc } from "./chain-helpers";

const { verifyAndRecordTx } = await import("@/lib/tx-verify");
const { indexToHead } = await import("@/indexer/core");
const { getLabels, addressHistory } = await import("@/lib/explorer");
const { getParticipantProgress } = await import("@/lib/data/progress");

const ABI = {
  factory: artifact("ProjectFactory").abi,
  project: artifact("Project").abi,
  marketplace: artifact("Marketplace").abi,
  nft: artifact("ScenarioNFT").abi,
};

const PROJECTS: Record<string, { name: string; price: string }> = {
  P01: { name: "Aurora Pixels", price: "0.01" },
  P02: { name: "Tidepool DAO", price: "0.015" },
  P03: { name: "Neon Ledger", price: "0.02" },
  P04: { name: "Granite Guild", price: "0.005" },
  P05: { name: "Lumen Labs", price: "0.01" },
};
// Which creators' projects each investor mints from (each stays within 0.03 ETH scenario funds).
const MINTS: Record<string, string[]> = {
  P06: ["P03", "P01"],
  P07: ["P03", "P04"],
  P08: ["P02", "P01"],
  P09: ["P03", "P04"],
  P10: ["P05", "P02"],
  P11: ["P03"],
  P12: ["P01", "P04", "P05"],
  P13: ["P02", "P04"],
  P14: ["P03", "P05"],
};
const HONEST_WITHDRAWAL = { creator: "P02", amount: parseEther("0.015") };
const MALICIOUS = "P03";

type Secrets = {
  scenarioId: number;
  participants: { id: string; username: string; role: ParticipantUser["role"]; address: string; privateKey: string }[];
  exchange1: { address: string };
  exchange2: { address: string };
};

let db: pg.Client;
let work: string;
let secrets: Secrets;
let sid: number;
let contracts: { factory: string; marketplace: string; nft: string };
let startBlock: number;
const wallet: Record<string, Wallet> = {};
const user: Record<string, ParticipantUser> = {};
const project: Record<string, string> = {};
let stolen: bigint;
const reported: { id: string; kind: string; hash: string }[] = [];

async function act(
  id: string,
  kind: Parameters<typeof verifyAndRecordTx>[1],
  send: Promise<{ hash: string; wait(): Promise<unknown> }>,
  meta = {},
) {
  const tx = await send;
  await tx.wait();
  const result = await verifyAndRecordTx(user[id], kind, tx.hash, meta);
  expect(result.status, `${id} ${kind}`).toBe("confirmed");
  reported.push({ id, kind, hash: tx.hash });
  return tx.hash;
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("TRUNCATE scenarios, organizers RESTART IDENTITY CASCADE");
  const [exchange1] = await devAccounts(); // a funded organizer address, as on Sepolia after the faucet
  startBlock = (await rpc.getBlockNumber()) + 1;

  work = mkdtempSync(path.join(tmpdir(), "picard-e2e-"));
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL!,
    NEXT_PUBLIC_CHAIN_ID: "31337",
    LOCAL_RPC_URL: process.env.RPC_URL!,
    DEPLOYMENTS_DIR: work,
  };
  const webDir = path.join(import.meta.dirname, "..");
  const contractsDir = path.join(webDir, "..", "contracts");
  const run = (cmd: string, args: string[], cwd: string) =>
    execFileSync(cmd, args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  // Organizer: provision wallets and logins, then the real deploy / register / fund scripts.
  run(
    process.execPath,
    [
      "scripts/provision-scenario.ts",
      "--name",
      "E2E",
      "--exchange1",
      exchange1,
      "--malicious",
      MALICIOUS,
      "--secrets-dir",
      work,
    ],
    webDir,
  );
  secrets = JSON.parse(
    readFileSync(path.join(work, readdirSync(work).find((f) => f.endsWith("-wallets.json"))!), "utf8"),
  );
  sid = secrets.scenarioId;
  for (const script of ["deploy", "register-creators", "fund-wallets"]) {
    run("npx", ["hardhat", "run", `scripts/${script}.ts`, "--network", "localhost"], contractsDir);
  }

  const row = (
    await db.query("SELECT factory_address, marketplace_address, nft_address FROM scenarios WHERE id = $1", [sid])
  ).rows[0];
  contracts = { factory: row.factory_address, marketplace: row.marketplace_address, nft: row.nft_address };
  for (const p of secrets.participants) {
    wallet[p.id] = new Wallet(p.privateKey, rpc);
    user[p.id] = {
      kind: "participant",
      scenarioId: sid,
      participantId: p.id,
      username: p.username,
      displayName: p.id,
      role: p.role,
      walletAddress: p.address,
    };
  }

  // Creators deploy their projects.
  for (const [id, cfg] of Object.entries(PROJECTS)) {
    const factory = new Contract(contracts.factory, ABI.factory, wallet[id]);
    await act(id, "create_project", factory.createProject(cfg.name, parseEther(cfg.price), ""), {
      description: `${cfg.name} (E2E)`,
    });
    project[id] = await factory.projectOfCreator(wallet[id].address);
  }
  // Investors mint.
  for (const [id, creators] of Object.entries(MINTS)) {
    const marketplace = new Contract(contracts.marketplace, ABI.marketplace, wallet[id]);
    for (const c of creators)
      await act(id, "mint", marketplace.mint(project[c], { value: parseEther(PROJECTS[c].price) }));
  }
  // An honest creator withdraws part of their funds.
  const honest = new Contract(project[HONEST_WITHDRAWAL.creator], ABI.project, wallet[HONEST_WITHDRAWAL.creator]);
  await act(HONEST_WITHDRAWAL.creator, "withdraw", honest.withdraw(HONEST_WITHDRAWAL.amount));
  // The malicious creator empties their project and passes the funds to the mule, who sends them on.
  const malicious = new Contract(project[MALICIOUS], ABI.project, wallet[MALICIOUS]);
  stolen = await malicious.availableToWithdraw();
  await act(MALICIOUS, "withdraw", malicious.withdraw(stolen));
  const mule = secrets.participants.find((p) => p.role === "mule")!;
  await act(MALICIOUS, "transfer", wallet[MALICIOUS].sendTransaction({ to: mule.address, value: stolen }));
  await act(
    mule.id,
    "mule_transfer",
    wallet[mule.id].sendTransaction({ to: secrets.exchange2.address, value: stolen }),
  );

  await indexToHead(db, rpc, sid);
}, 240_000);

afterAll(async () => {
  await db.end();
  rmSync(work, { recursive: true, force: true }); // throwaway local keys from provisioning
});

const priceOf = (creator: string) => parseEther(PROJECTS[creator].price);
const expectedReceived = (creator: string) =>
  Object.values(MINTS)
    .flat()
    .filter((c) => c === creator)
    .reduce((s) => s + priceOf(creator), 0n);

describe("end-to-end role-play (17 wallets)", () => {
  it("provisioned 15 participants with fresh wallets plus two exchanges", async () => {
    expect(secrets.participants.map((p) => p.role)).toEqual([
      ...Array(5).fill("creator"),
      ...Array(9).fill("investor"),
      "mule",
    ]);
    const addresses = new Set([
      ...secrets.participants.map((p) => p.address),
      secrets.exchange1.address,
      secrets.exchange2.address,
    ]);
    expect(addresses.size).toBe(17);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM participants WHERE scenario_id = $1", [sid]);
    expect(rows[0].n).toBe(15);
  });

  it("funded every wallet exactly once from Exchange 1, per the funding plan", async () => {
    const { rows } = await db.query(
      `SELECT lower(to_address) AS to, value_wei::text AS value FROM chain_txs
        WHERE scenario_id = $1 AND lower(from_address) = lower($2) AND method = 'transfer' AND status = 1`,
      [sid, secrets.exchange1.address],
    );
    expect(rows).toHaveLength(15);
    const plan = { creator: parseEther("0.05"), investor: parseEther("0.05"), mule: parseEther("0.01") };
    for (const p of secrets.participants) {
      expect(rows.find((r) => r.to === p.address.toLowerCase())?.value, p.id).toBe(plan[p.role].toString());
    }
    const recorded = await db.query(
      "SELECT count(*)::int AS n FROM funding_transfers WHERE scenario_id = $1 AND status = 'confirmed'",
      [sid],
    );
    expect(recorded.rows[0].n).toBe(15);
  });

  it("links each creator to exactly one project via ProjectCreated", async () => {
    const { rows } = await db.query(
      "SELECT args FROM chain_events WHERE scenario_id = $1 AND event_name = 'ProjectCreated' ORDER BY block_number",
      [sid],
    );
    expect(rows.map((r) => [r.args.creator, r.args.project, r.args.name])).toEqual(
      Object.entries(PROJECTS).map(([id, cfg]) => [wallet[id].address, project[id], cfg.name]),
    );
  });

  it("routed every mint payment to the chosen project, and the totals add up", async () => {
    const { rows } = await db.query(
      "SELECT args FROM chain_events WHERE scenario_id = $1 AND event_name = 'PaymentRouted'",
      [sid],
    );
    expect(rows).toHaveLength(18);
    for (const [creator] of Object.entries(PROJECTS)) {
      const routed = rows
        .filter((r) => r.args.project === project[creator])
        .reduce((s, r) => s + BigInt(r.args.amount), 0n);
      const onchain = new Contract(project[creator], ABI.project, rpc);
      expect(routed, creator).toBe(expectedReceived(creator));
      expect(await onchain.totalReceived(), creator).toBe(expectedReceived(creator));
    }
    expect(await rpc.getBalance(contracts.marketplace)).toBe(0n);

    const nft = new Contract(contracts.nft, ABI.nft, rpc);
    for (const [investor, creators] of Object.entries(MINTS)) {
      expect(await nft.balanceOf(wallet[investor].address), investor).toBe(BigInt(creators.length));
    }
    const mints = await db.query(
      "SELECT count(*)::int AS n FROM chain_events WHERE scenario_id = $1 AND event_name = 'Transfer' AND args->>'from' = $2",
      [sid, ZeroAddress],
    );
    expect(mints.rows[0].n).toBe(18);
  });

  it("records project withdrawals and the remaining balances", async () => {
    const { rows } = await db.query(
      "SELECT contract_address, args FROM chain_events WHERE scenario_id = $1 AND event_name = 'Withdrawn' ORDER BY block_number",
      [sid],
    );
    expect(rows.map((r) => [r.contract_address, r.args.to, r.args.amount])).toEqual([
      [project.P02, wallet.P02.address, HONEST_WITHDRAWAL.amount.toString()],
      [project.P03, wallet.P03.address, expectedReceived("P03").toString()],
    ]);
    for (const creator of Object.keys(PROJECTS)) {
      const withdrawn = creator === "P02" ? HONEST_WITHDRAWAL.amount : creator === "P03" ? expectedReceived("P03") : 0n;
      expect(await rpc.getBalance(project[creator]), creator).toBe(expectedReceived(creator) - withdrawn);
    }
  });

  it("lets the money trail be followed from the project to Exchange 2 using public data only", async () => {
    // Start from the malicious project's Withdrawn event and follow equal-value transfers forward.
    const withdrawal = (
      await db.query(
        "SELECT block_number, args FROM chain_events WHERE scenario_id = $1 AND event_name = 'Withdrawn' AND contract_address = $2",
        [sid, project[MALICIOUS]],
      )
    ).rows[0];
    const amount = withdrawal.args.amount as string;
    const nextHop = async (from: string, after: number) =>
      (
        await db.query(
          `SELECT to_address, block_number FROM chain_txs WHERE scenario_id = $1 AND lower(from_address) = lower($2)
             AND value_wei = $3 AND status = 1 AND block_number >= $4 ORDER BY block_number LIMIT 1`,
          [sid, from, amount, after],
        )
      ).rows[0];

    const hop1 = await nextHop(withdrawal.args.to, Number(withdrawal.block_number));
    const mule = secrets.participants.find((p) => p.role === "mule")!;
    expect(hop1.to_address).toBe(mule.address);
    const hop2 = await nextHop(hop1.to_address, Number(hop1.block_number));
    expect(hop2.to_address).toBe(secrets.exchange2.address);
    expect(await rpc.getBalance(secrets.exchange2.address)).toBe(BigInt(amount)); // fresh wallet: only this
    expect(BigInt(amount)).toBe(stolen);
  });

  it("reconciles every participant and Exchange 2 balance exactly from indexed activity and receipts", async () => {
    const addresses = [...secrets.participants.map((p) => p.address), secrets.exchange2.address];
    for (const address of addresses) {
      const h = await addressHistory(sid, address);
      const lower = address.toLowerCase();
      let expected = 0n;
      for (const tx of h.txs) {
        if (tx.to?.toLowerCase() === lower && tx.status === 1) expected += BigInt(tx.valueWei);
        if (tx.from.toLowerCase() === lower) {
          if (tx.status === 1) expected -= BigInt(tx.valueWei);
          expected -= (await rpc.getTransactionReceipt(tx.hash))!.fee;
        }
      }
      for (const t of h.internal) {
        if (t.to.toLowerCase() === lower) expected += BigInt(t.valueWei);
        if (t.from.toLowerCase() === lower) expected -= BigInt(t.valueWei);
      }
      expect(await rpc.getBalance(address), address).toBe(expected);
    }
  });

  it("indexed activity for all 17 scenario wallets", async () => {
    const all = [...secrets.participants.map((p) => p.address), secrets.exchange1.address, secrets.exchange2.address];
    for (const address of all) {
      const { rows } = await db.query(
        "SELECT count(*)::int AS n FROM chain_txs WHERE scenario_id = $1 AND (lower(from_address) = lower($2) OR lower(to_address) = lower($2))",
        [sid, address],
      );
      expect(rows[0].n, address).toBeGreaterThan(0);
    }
    const first = (await db.query("SELECT min(block_number)::int AS b FROM chain_txs WHERE scenario_id = $1", [sid]))
      .rows[0].b;
    expect(first).toBeGreaterThanOrEqual(startBlock);
  });

  it("recorded every participant action as server-verified and confirmed", async () => {
    expect(reported).toHaveLength(5 + 18 + 2 + 1 + 1);
    const { rows } = await db.query(
      "SELECT participant_id, kind, tx_hash, status FROM tx_requests WHERE scenario_id = $1 ORDER BY id",
      [sid],
    );
    expect(rows.map((r) => [r.participant_id, r.kind, r.tx_hash, r.status])).toEqual(
      reported.map((r) => [r.id, r.kind, r.hash, "confirmed"]),
    );
  });

  it("keeps the storyline hidden in public labels and shows it only to the organizer", async () => {
    const labels = [...(await getLabels(sid)).values()].join(" ");
    expect(labels).not.toMatch(/mule|malicious|creator|investor/i);
    const progress = Object.fromEntries((await getParticipantProgress(sid)).map((p) => [p.id, p]));
    expect(progress.P03).toMatchObject({
      projectCreated: true,
      withdrawnWei: stolen.toString(),
      sentWei: stolen.toString(),
    });
    expect(progress.P15).toMatchObject({ receivedWei: stolen.toString(), sentWei: stolen.toString() });
    expect(
      Object.values(progress)
        .filter((p) => p.role === "investor")
        .reduce((n, p) => n + p.mints, 0),
    ).toBe(18);

    console.log(
      `E2E evidence: ${formatEther(stolen)} ETH  ${project[MALICIOUS]} → ${wallet[MALICIOUS].address} (P03) → ` +
        `${secrets.participants[14].address} (P15) → ${secrets.exchange2.address} (Exchange 2)`,
    );
  });
});
