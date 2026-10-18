import "server-only";
import { getServerConfig } from "../config";
import { queryOne } from "../db";

// Public scenario fields only. Safe to show any logged-in participant.
export type PublicScenario = {
  id: number;
  name: string;
  chainId: number;
  exchange2Address: string | null;
  exchange2Label: string; // public explorer label, e.g. "Tornado Cash (mixer stand-in)"
  minMintPriceWei: string;
  maxMintPriceWei: string;
};

export async function getActiveScenario(): Promise<PublicScenario | null> {
  const row = await queryOne<{
    id: number;
    name: string;
    chain_id: number;
    exchange2_address: string | null;
    exchange2_label: string;
    min_mint_price_wei: string;
    max_mint_price_wei: string;
  }>(
    `SELECT id, name, chain_id, exchange2_address, min_mint_price_wei, max_mint_price_wei,
            coalesce(nullif((SELECT public_label FROM known_addresses k WHERE k.scenario_id = s.id
                               AND lower(k.address) = lower(s.exchange2_address)), ''), 'Exchange 2') AS exchange2_label
       FROM scenarios s WHERE is_active AND chain_id = $1`,
    [getServerConfig().chain.id],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    chainId: row.chain_id,
    exchange2Address: row.exchange2_address,
    exchange2Label: row.exchange2_label,
    minMintPriceWei: row.min_mint_price_wei,
    maxMintPriceWei: row.max_mint_price_wei,
  };
}
