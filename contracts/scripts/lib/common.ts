// Shared helpers for organizer scripts. These scripts run only on the organizer's machine.
// They sign with organizer keys (Hardhat dev accounts locally, the Hardhat keystore on Sepolia)
// and never send those keys anywhere else.
import { existsSync } from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import pg from "pg";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
export const SUPPORTED_CHAIN_IDS = [31337, 11155111] as const;

// Reads DATABASE_URL and NEXT_PUBLIC_CHAIN_ID from the web app's env file so both sides agree.
const webEnv = path.join(REPO_ROOT, "web", ".env.local");
if (existsSync(webEnv)) process.loadEnvFile(webEnv);

export async function connect() {
  const connection = await network.create();
  const { ethers } = connection;
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  if (!(SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId)) {
    throw new Error(`Refusing to run on chain ${chainId}. Only 31337 (local) and 11155111 (Sepolia) are allowed.`);
  }
  const configured = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  if (configured !== chainId) {
    throw new Error(
      `Connected to chain ${chainId} but web/.env.local has NEXT_PUBLIC_CHAIN_ID=${process.env.NEXT_PUBLIC_CHAIN_ID}.`,
    );
  }

  // Local: Hardhat account 0 is Exchange 1 (matches the DB seed) and account 17 deploys, so
  //        contract deployments don't appear in Exchange 1's history.
  // Sepolia: signer 0 = deployer, signer 1 = Exchange 1 (see hardhat.config.ts).
  const signers = await ethers.getSigners();
  const [deployer, exchange1] = chainId === 31337 ? [signers[17], signers[0]] : [signers[0], signers[1]];
  if (!deployer || !exchange1) throw new Error("Deployer and Exchange 1 signers are not configured.");

  return { connection, ethers, chainId, deployer, exchange1 };
}

export async function openDb(): Promise<pg.Client> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (web/.env.local).");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

export type ScenarioRow = {
  id: number;
  name: string;
  exchange1_address: string | null;
  exchange2_address: string | null;
  factory_address: string | null;
  marketplace_address: string | null;
  nft_address: string | null;
  min_mint_price_wei: string;
  max_mint_price_wei: string;
};

export async function getActiveScenario(db: pg.Client, chainId: number): Promise<ScenarioRow> {
  const { rows } = await db.query<ScenarioRow>(
    `SELECT id, name, exchange1_address, exchange2_address, factory_address, marketplace_address, nft_address,
            min_mint_price_wei::text, max_mint_price_wei::text
       FROM scenarios WHERE is_active AND chain_id = $1`,
    [chainId],
  );
  if (!rows[0]) throw new Error(`No active scenario for chain ${chainId}. Seed or create one first.`);
  return rows[0];
}

export function deploymentFile(chainId: number): string {
  return path.join(REPO_ROOT, "deployments", `${chainId}.json`);
}

export function sameAddress(a: string | null, b: string): boolean {
  return a !== null && a.toLowerCase() === b.toLowerCase();
}
