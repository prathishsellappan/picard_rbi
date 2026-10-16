# Local setup

## Requirements

- Node.js 22 LTS or newer (`.nvmrc` pins 22; Node 26 is known to work for Stage 2)
- PostgreSQL 17 (macOS: `brew install postgresql@17 && brew services start postgresql@17`)

## First run

```bash
npm install
createdb picard                  # dev database
createdb picard_test             # used only by the test suite (it is wiped on every run)
cp web/.env.example web/.env.local
npm run db:migrate
npm run db:seed
npm run dev                      # http://localhost:3000
```

`npm run db:seed` creates the **local** rehearsal scenario (chain 31337 only):

| Hardhat account | Role |
|---|---|
| 0 | Exchange 1 |
| 1–5 | Creators P01–P05 |
| 6–14 | Investors P06–P14 |
| 15 | Mule P15 |
| 16 | Exchange 2 |

These are the public Hardhat development accounts. Only their addresses are stored. Login cards
(participant ID + password, plus the organizer login) are written to
`organizer-secrets/credentials-local.csv`, which is gitignored. Re-run with
`npm run db:seed -- --reset` to wipe the local scenario's application data and issue new
passwords. This does not touch any blockchain.

## Local chain and contracts

Run the Hardhat node in its own terminal and keep it running:

```bash
npm run node -w contracts            # local chain, http://127.0.0.1:8545, chain 31337
```

Then, in another terminal:

```bash
npm test -w contracts                # contract unit tests (in-memory chain, no node needed)
npm run deploy:local -w contracts    # deploy NFT, factory, marketplace for the active scenario
npm run register-creators:local -w contracts
npm run fund:local -w contracts      # Exchange 1 → all 15 participant wallets
```

Contract details, permissions and events: [CONTRACTS.md](CONTRACTS.md).

**Local reset.** Stopping the Hardhat node erases the local chain. The database then still points
at contracts that no longer exist, so reset both:

```bash
npm run db:seed -- --reset           # new local scenario and new login cards
npm run deploy:local -w contracts
npm run register-creators:local -w contracts
npm run fund:local -w contracts
```

Also clear MetaMask's activity data for the local network ("Clear activity tab data"), or it will
reuse stale nonces. This applies only to the local chain. Sepolia history can't be erased: use a
new scenario deployment there instead.

Hardhat's development accounts start with 10,000 ETH each, so local funding transfers create the
expected on-chain records but don't change what participants can afford.

## Environment variables (`web/.env.local`)

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `31337` (local) or `11155111` (Sepolia). Anything else stops the app. |
| `RPC_URL` | Server-side JSON-RPC endpoint for that chain. Keep provider keys out of git. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `SESSION_TTL_HOURS` | Login session lifetime (1–72, default 12). |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests plus database-backed auth/authorization tests (uses `picard_test`; override with `TEST_DATABASE_URL`, which must end in `_test`) |
| `npm run db:migrate` | Apply `web/db/migrations/*.sql` |
| `npm run db:seed` | Create the local rehearsal scenario |
| `npm test -w contracts` | Contract tests |
| `npm run typecheck -w contracts` | Compile and type-check contracts and scripts |

## How access works

- Participants log in with the ID and password from their card. The organizer logs in as `organizer`.
- Role and assigned wallet always come from the server session, never from the browser.
- Every page and API route checks the role on the server. Hiding a link is not treated as security.
- Participant APIs never return the malicious flag or organizer notes. A participant sees only their own instructions.

## What is mock in Stage 2

Project lists, NFT ownership, transaction history, and the explorer show **mock data**, and each
mock panel is labelled. Wallet connection, transactions, and indexing arrive in Stages 4–6.
Organizer configuration (participants, roles, wallets, instructions, exchanges, mint bounds,
funding plan) is real and stored in Postgres.

## Event-day device setup (Option A)

The organizer prepares each participant's device beforehand: MetaMask installed, the participant's
assigned wallet imported, and the correct network selected. Participants receive only a login card.
Private keys never enter this application, its database, or git.
