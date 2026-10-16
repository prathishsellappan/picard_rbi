-- Indexed copy of the scenario's on-chain activity, written only by the indexer from RPC data.
-- The chain stays the source of truth; these tables make address histories searchable, which a
-- plain RPC endpoint can't do. Rows are scoped per scenario (one scenario = one chain).

-- Top-level transactions sent from or to a scenario address or contract.
CREATE TABLE chain_txs (
  scenario_id   INTEGER NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  hash          TEXT NOT NULL,
  block_number  BIGINT NOT NULL,
  block_time    TIMESTAMPTZ NOT NULL,
  tx_index      INTEGER NOT NULL,
  from_address  TEXT NOT NULL,
  to_address    TEXT,                  -- null for contract creation
  value_wei     NUMERIC(78, 0) NOT NULL,
  status        SMALLINT,              -- 1 success, 0 reverted
  gas_used      NUMERIC(78, 0),
  method        TEXT NOT NULL,         -- decoded function name, 'transfer' for plain ETH, or the selector
  created_contract TEXT,
  PRIMARY KEY (scenario_id, hash)
);
CREATE INDEX chain_txs_from ON chain_txs (scenario_id, lower(from_address));
CREATE INDEX chain_txs_to ON chain_txs (scenario_id, lower(to_address));
CREATE INDEX chain_txs_block ON chain_txs (scenario_id, block_number DESC, tx_index DESC);

-- Decoded events from the scenario contracts (factory, marketplace, NFT, every project).
CREATE TABLE chain_events (
  scenario_id   INTEGER NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  tx_hash       TEXT NOT NULL,
  log_index     INTEGER NOT NULL,
  block_number  BIGINT NOT NULL,
  block_time    TIMESTAMPTZ NOT NULL,
  contract_address TEXT NOT NULL,
  contract_kind TEXT NOT NULL,         -- factory | marketplace | nft | project
  event_name    TEXT NOT NULL,
  args          JSONB NOT NULL,        -- decoded args; uint values as decimal strings
  PRIMARY KEY (scenario_id, tx_hash, log_index)
);
CREATE INDEX chain_events_name ON chain_events (scenario_id, event_name);
CREATE INDEX chain_events_args ON chain_events USING GIN (args);

CREATE TABLE indexer_state (
  scenario_id   INTEGER PRIMARY KEY REFERENCES scenarios (id) ON DELETE CASCADE,
  last_block    BIGINT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
