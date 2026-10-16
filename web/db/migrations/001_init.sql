-- Application state. The blockchain remains the source of truth for transactions;
-- indexed chain data gets its own tables in Stage 6.

CREATE TYPE participant_role AS ENUM ('creator', 'investor', 'mule');

CREATE TYPE tx_status AS ENUM ('requested', 'pending', 'confirmed', 'failed', 'rejected', 'timeout');

-- One row per scenario deployment. A Sepolia rehearsal and the live run are separate scenarios.
CREATE TABLE scenarios (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  chain_id              INTEGER NOT NULL CHECK (chain_id IN (31337, 11155111)),
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  exchange1_address     TEXT,
  exchange2_address     TEXT,
  factory_address       TEXT,
  marketplace_address   TEXT,
  nft_address           TEXT,
  start_block           BIGINT,
  min_mint_price_wei    NUMERIC(78, 0) NOT NULL DEFAULT 5000000000000000,   -- 0.005 ETH
  max_mint_price_wei    NUMERIC(78, 0) NOT NULL DEFAULT 20000000000000000,  -- 0.02 ETH
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_mint_price_wei > 0 AND min_mint_price_wei <= max_mint_price_wei)
);

-- At most one active scenario per chain.
CREATE UNIQUE INDEX scenarios_one_active_per_chain ON scenarios (chain_id) WHERE is_active;

-- Public participant information. Never holds keys or seed phrases.
CREATE TABLE participants (
  id              TEXT NOT NULL,                       -- e.g. P01
  scenario_id     INTEGER NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  role            participant_role NOT NULL,
  wallet_address  TEXT NOT NULL,                       -- checksummed
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, id)
);

CREATE UNIQUE INDEX participants_wallet_per_scenario ON participants (scenario_id, lower(wallet_address));

-- Private scenario data. Only organizer queries read is_malicious / organizer_notes;
-- a participant may read only their own instructions.
CREATE TABLE participant_private (
  scenario_id      INTEGER NOT NULL,
  participant_id   TEXT NOT NULL,
  instructions     TEXT NOT NULL DEFAULT '',
  is_malicious     BOOLEAN NOT NULL DEFAULT FALSE,
  organizer_notes  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (scenario_id, participant_id),
  FOREIGN KEY (scenario_id, participant_id) REFERENCES participants (scenario_id, id) ON DELETE CASCADE
);

CREATE TABLE organizers (
  id             SERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a SHA-256 hash of the session token is stored.
CREATE TABLE sessions (
  token_hash      TEXT PRIMARY KEY,
  organizer_id    INTEGER REFERENCES organizers (id) ON DELETE CASCADE,
  scenario_id     INTEGER,
  participant_id  TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (scenario_id, participant_id) REFERENCES participants (scenario_id, id) ON DELETE CASCADE,
  CHECK ((organizer_id IS NOT NULL) <> (participant_id IS NOT NULL))
);

-- The 17 scenario addresses with neutral public labels (no roles).
CREATE TABLE known_addresses (
  scenario_id   INTEGER NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  address       TEXT NOT NULL,
  public_label  TEXT NOT NULL,
  PRIMARY KEY (scenario_id, address)
);

-- Project metadata. Contract address and creation tx are filled from confirmed receipts.
CREATE TABLE projects (
  id                SERIAL PRIMARY KEY,
  scenario_id       INTEGER NOT NULL,
  creator_id        TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  image_url         TEXT,
  mint_price_wei    NUMERIC(78, 0) NOT NULL CHECK (mint_price_wei > 0),
  contract_address  TEXT,
  onchain_id        INTEGER,
  creation_tx_hash  TEXT,
  status            tx_status NOT NULL DEFAULT 'requested',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (scenario_id, creator_id) REFERENCES participants (scenario_id, id) ON DELETE CASCADE,
  UNIQUE (scenario_id, creator_id)   -- one project per creator
);

-- Initial funding amounts per role. Gas money is kept separate from scenario funds.
CREATE TABLE funding_plan (
  scenario_id   INTEGER NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  role          participant_role NOT NULL,
  gas_wei       NUMERIC(78, 0) NOT NULL DEFAULT 0 CHECK (gas_wei >= 0),
  scenario_wei  NUMERIC(78, 0) NOT NULL DEFAULT 0 CHECK (scenario_wei >= 0),
  PRIMARY KEY (scenario_id, role)
);

-- Exchange 1 distribution records (one tx per wallet; the split is recorded here).
CREATE TABLE funding_transfers (
  id            SERIAL PRIMARY KEY,
  scenario_id   INTEGER NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
  to_address    TEXT NOT NULL,
  gas_wei       NUMERIC(78, 0) NOT NULL,
  scenario_wei  NUMERIC(78, 0) NOT NULL,
  tx_hash       TEXT,
  status        tx_status NOT NULL DEFAULT 'requested',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Application-side tracking of participant transactions (application state, not proof).
CREATE TABLE tx_requests (
  id              SERIAL PRIMARY KEY,
  scenario_id     INTEGER NOT NULL,
  participant_id  TEXT NOT NULL,
  kind            TEXT NOT NULL,          -- create_project | mint | withdraw | transfer
  tx_hash         TEXT,
  status          tx_status NOT NULL DEFAULT 'requested',
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (scenario_id, participant_id) REFERENCES participants (scenario_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX tx_requests_hash ON tx_requests (scenario_id, tx_hash) WHERE tx_hash IS NOT NULL;
