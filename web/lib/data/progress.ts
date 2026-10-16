import "server-only";
import { query } from "../db";

// Organizer-only progress view built from the chain index (not from what the app recorded).

export type ParticipantProgress = {
  id: string;
  username: string;
  role: string;
  wallet: string;
  funded: boolean;
  projectCreated: boolean;
  mints: number;
  withdrawnWei: string;
  sentWei: string;
  receivedWei: string;
  lastBlock: number | null;
};

export async function getParticipantProgress(scenarioId: number): Promise<ParticipantProgress[]> {
  const rows = await query<{
    id: string;
    username: string;
    role: string;
    wallet_address: string;
    funded: boolean;
    project_created: boolean;
    mints: string;
    withdrawn_wei: string;
    sent_wei: string;
    received_wei: string;
    last_block: string | null;
  }>(
    `WITH tx AS (SELECT * FROM chain_txs WHERE scenario_id = $1 AND status = 1),
          ev AS (SELECT * FROM chain_events WHERE scenario_id = $1),
          ex1 AS (SELECT lower(exchange1_address) AS a FROM scenarios WHERE id = $1)
     SELECT p.id, p.username, p.role, p.wallet_address,
            EXISTS (SELECT 1 FROM tx, ex1 WHERE lower(tx.from_address) = ex1.a
                      AND lower(tx.to_address) = lower(p.wallet_address)) AS funded,
            EXISTS (SELECT 1 FROM ev WHERE event_name = 'ProjectCreated'
                      AND lower(args->>'creator') = lower(p.wallet_address)) AS project_created,
            (SELECT count(*) FROM ev WHERE event_name = 'PaymentRouted'
               AND lower(args->>'investor') = lower(p.wallet_address))::text AS mints,
            coalesce((SELECT sum((args->>'amount')::numeric) FROM ev WHERE event_name = 'Withdrawn'
               AND lower(args->>'to') = lower(p.wallet_address)), 0)::text AS withdrawn_wei,
            coalesce((SELECT sum(value_wei) FROM tx WHERE method = 'transfer'
               AND lower(from_address) = lower(p.wallet_address)), 0)::text AS sent_wei,
            coalesce((SELECT sum(value_wei) FROM tx, ex1 WHERE method = 'transfer'
               AND lower(to_address) = lower(p.wallet_address) AND lower(from_address) <> ex1.a), 0)::text AS received_wei,
            (SELECT max(block_number) FROM chain_txs t WHERE t.scenario_id = $1
               AND lower(t.from_address) = lower(p.wallet_address))::text AS last_block
       FROM participants p WHERE p.scenario_id = $1 ORDER BY p.id`,
    [scenarioId],
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    wallet: r.wallet_address,
    funded: r.funded,
    projectCreated: r.project_created,
    mints: Number(r.mints),
    withdrawnWei: r.withdrawn_wei,
    sentWei: r.sent_wei,
    receivedWei: r.received_wei,
    lastBlock: r.last_block ? Number(r.last_block) : null,
  }));
}
