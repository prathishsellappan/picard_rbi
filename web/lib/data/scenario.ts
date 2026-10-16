import "server-only";
import { getServerConfig } from "../config";
import { queryOne } from "../db";

// Public scenario fields only. Safe to show any logged-in participant.
export type PublicScenario = {
  id: number;
  name: string;
  chainId: number;
  exchange2Address: string | null;
  minMintPriceWei: string;
  maxMintPriceWei: string;
};

export async function getActiveScenario(): Promise<PublicScenario | null> {
  const row = await queryOne<{
    id: number;
    name: string;
    chain_id: number;
    exchange2_address: string | null;
    min_mint_price_wei: string;
    max_mint_price_wei: string;
  }>(
    `SELECT id, name, chain_id, exchange2_address, min_mint_price_wei, max_mint_price_wei
       FROM scenarios WHERE is_active AND chain_id = $1`,
    [getServerConfig().chain.id],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    chainId: row.chain_id,
    exchange2Address: row.exchange2_address,
    minMintPriceWei: row.min_mint_price_wei,
    maxMintPriceWei: row.max_mint_price_wei,
  };
}
