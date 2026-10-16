import "server-only";
import { query, queryOne } from "../db";
import type { ParticipantRole } from "../roles";

// Organizer-only queries. Callers must have passed requireOrganizer()/authorize(["organizer"]).

export type OrganizerParticipantRow = {
  id: string;
  username: string;
  display_name: string;
  role: ParticipantRole;
  wallet_address: string;
  instructions: string;
  is_malicious: boolean;
  organizer_notes: string;
};

export async function listParticipantsForOrganizer(scenarioId: number): Promise<OrganizerParticipantRow[]> {
  return query<OrganizerParticipantRow>(
    `SELECT p.id, p.username, p.display_name, p.role, p.wallet_address,
            coalesce(pp.instructions, '') AS instructions,
            coalesce(pp.is_malicious, FALSE) AS is_malicious,
            coalesce(pp.organizer_notes, '') AS organizer_notes
       FROM participants p
       LEFT JOIN participant_private pp ON pp.scenario_id = p.scenario_id AND pp.participant_id = p.id
      WHERE p.scenario_id = $1
      ORDER BY p.id`,
    [scenarioId],
  );
}

export type OrganizerScenarioRow = {
  id: number;
  name: string;
  chain_id: number;
  exchange1_address: string | null;
  exchange2_address: string | null;
  factory_address: string | null;
  marketplace_address: string | null;
  nft_address: string | null;
  start_block: string | null;
  min_mint_price_wei: string;
  max_mint_price_wei: string;
};

export async function getScenarioForOrganizer(chainId: number): Promise<OrganizerScenarioRow | null> {
  return queryOne<OrganizerScenarioRow>(
    `SELECT id, name, chain_id, exchange1_address, exchange2_address, factory_address,
            marketplace_address, nft_address, start_block::text, min_mint_price_wei::text,
            max_mint_price_wei::text
       FROM scenarios WHERE is_active AND chain_id = $1`,
    [chainId],
  );
}

export type FundingPlanRow = { role: ParticipantRole; gas_wei: string; scenario_wei: string };

export async function getFundingPlan(scenarioId: number): Promise<FundingPlanRow[]> {
  return query<FundingPlanRow>(
    `SELECT role, gas_wei::text, scenario_wei::text FROM funding_plan
      WHERE scenario_id = $1 ORDER BY array_position(ARRAY['creator','investor','mule']::participant_role[], role)`,
    [scenarioId],
  );
}
