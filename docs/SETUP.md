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
| `npm test` | Web tests, then contract tests. Web tests use the `picard_test` database (override with `TEST_DATABASE_URL`, which must end in `_test`), compile the contracts, and start a throwaway Hardhat node on port 8546 where they deploy the contracts and run the project, mint and withdraw flows through the server's verification code |
| `npm run db:migrate` | Apply `web/db/migrations/*.sql` |
| `npm run db:seed` | Create the local rehearsal scenario |
| `npm test -w contracts` | Contract tests |
| `npm run typecheck -w contracts` | Compile and type-check contracts and scripts |

## How access works

- Participants log in with the ID and password from their card. The organizer logs in as `organizer`.
- Role and assigned wallet always come from the server session, never from the browser.
- Every page and API route checks the role on the server. Hiding a link is not treated as security.
- Participant APIs never return the malicious flag or organizer notes. A participant sees only their own instructions.

## Wallet connection (Stage 4)

Each participant dashboard has a wallet panel:

1. On load the app quietly asks MetaMask which account is connected. There's no popup until the
   participant clicks **Connect MetaMask**.
2. The connected account is compared with the participant's assigned wallet from the server session.
   Any other account shows "This is not your assigned wallet", and every action stays disabled.
3. The chain must be the configured one (`NEXT_PUBLIC_CHAIN_ID`). Otherwise a **Switch to …**
   button appears. The app never switches networks by itself.
4. Account and network changes in MetaMask are picked up immediately. Switching to another account
   or chain blocks actions again until the assigned wallet is back on the right chain.
5. Right before signing, the app re-checks account and chain with MetaMask, and ethers is pinned
   to the chain ID, so a mid-flow switch can't send from the wrong wallet or network.

**Transaction states** shown to participants: requested (approve in MetaMask) → pending (hash
shown) → confirmed / failed, plus rejected (declined in MetaMask) and timeout (no receipt yet;
**Check again** asks the server to re-read the chain).

**Server-side check.** The browser only reports a transaction hash. `POST /api/tx` fetches the
transaction and receipt from `RPC_URL` and records it only if:
- it was sent from the participant's assigned wallet,
- its type is allowed for their role,
- it is the expected kind of transaction (a plain ETH transfer; the mule's must go to Exchange 2).

The stored status is always what the chain returned, never what the browser claimed. On first use
the server also checks that `RPC_URL` serves the configured chain ID.

Transaction types the server accepts, per role:

| Kind | Role | Must be |
|---|---|---|
| `transfer` | creator | plain ETH transfer from the creator's wallet |
| `mule_transfer` | mule | plain ETH transfer to Exchange 2 |
| `create_project` | creator | `createProject()` call to the scenario's factory |
| `withdraw` | creator | `withdraw()` call to the creator's own project (looked up in the factory) |
| `mint` | investor | `mint()` call to the scenario's marketplace |

## Participant workflows (Stage 5)

Before these work, the organizer must run `deploy:local`, `register-creators:local` and
`fund:local` (see above).

- **Creator**
  - Creates one project: name, description, and a mint price within the factory's on-chain bounds.
    A review step comes first, then MetaMask.
  - Then sees the project read from its contract: mint price, NFTs minted, total received,
    withdrawn and available.
  - Can withdraw any amount up to "available", always to their own wallet.
  - Has the "Send test ETH" panel for ordinary transfers.
- **Investor:** sees every project registered in the factory and mints one NFT per click, paying
  exactly the mint price. "My NFTs" comes from on-chain ownership in the NFT contract.
- **Mule:** "Transfer to Exchange 2" (fixed recipient, "Max" keeps a gas reserve). The incoming
  transfer list arrives with the indexer in Stage 6.

**Where the data comes from:**
- Project facts and NFT ownership are read from the contracts on every page load.
- The database holds only each project's description, which the creator enters and which is
  linked once the `createProject` receipt is confirmed.
- A project created outside the app still appears in the marketplace, just without a description.
- If a contract call would revert, MetaMask is never opened and the participant sees the reason
  in plain language, for example "Your wallet is not approved to create a project yet."

NFT metadata for `tokenURI` is served publicly at `/api/nft/<tokenId>` (project name, description
and contract address only).

**Local MetaMask setup (prepared devices).** Add a network with RPC `http://127.0.0.1:8545` and chain ID
31337 (or press **Switch to Local Hardhat**, which offers to add it). Then import the participant's
Hardhat dev account. These keys are public test keys for local use only.

## Indexer and explorer (Stage 6)

A plain RPC endpoint can't list an address's transaction history, so a small indexer copies the
scenario's activity into Postgres (`chain_txs`, `chain_events`):

- **Transactions:** every transaction sent from or to one of the 17 scenario addresses or a scenario
  contract, plus the contracts' own deployment transactions. It finds them by scanning each block
  from the scenario's deploy block.
- **Events:** every event from the factory, marketplace, NFT and all project contracts.
- **Internal ETH movements:** marketplace → project and project → creator happen inside other
  transactions. The explorer shows them as internal transfers, rebuilt from `FundsReceived` and
  `Withdrawn` events.

Run it while the role-play is live:

```bash
npm run indexer          # keeps polling for new blocks (Ctrl+C to stop)
npm run indexer -- --once
```

The organizer overview also has **Sync index now**, which runs the same indexer once to the chain
head, and a participant-progress table built from the index. The indexer is idempotent: it stores
each block range in one transaction and only then moves its cursor. On Sepolia it stays 3 blocks
behind the head, so a small reorg can't leave bad rows.

**Explorer** (any logged-in user, under **Explorer**):
- Search by address or transaction hash.
- Directory of scenario addresses and contracts.
- Latest transactions.
- Address pages: live balance, incoming and outgoing transactions, internal ETH movements, NFT
  transfers, and events emitted by a contract.
- Transaction pages, **read live from the chain**: status, block, timestamp, from/to, value,
  method, gas, decoded scenario events, and internal movements.
- On Sepolia, every address and transaction links to Etherscan.

Labels are neutral: participant IDs (`P01`…), `Exchange 1`/`Exchange 2`, contract names and
`Project: <name>`. Roles, instructions and the malicious flag never appear.

The mule dashboard's **Incoming transfers** list comes from the same index.

## Event-day device setup (Option A)

The organizer prepares each participant's device beforehand: MetaMask installed, the participant's
assigned wallet imported, and the correct network selected. Participants receive only a login card.
Private keys never enter this application, its database, or git.
