# Architecture

Educational crypto-fraud role-play on a local Hardhat network or Ethereum Sepolia.
Test assets only; nothing here has monetary value.

## Components

```
┌──────────────────────── Next.js app (web/) ─────────────────────────┐
│ Browser: React + Tailwind + ethers BrowserProvider (MetaMask)       │
│   - chain-ID check, assigned-wallet check, accountsChanged handling │
│   - signs participant transactions (no keys ever reach the server)  │
│ Server routes: login/session, role guards, project metadata,        │
│   tx tracking (verifies receipts via RPC), explorer queries         │
└──────────────┬────────────────────────────────┬─────────────────────┘
               │ pg                             │ JSON-RPC (ethers JsonRpcProvider)
         PostgreSQL                   Hardhat node (31337) │ Sepolia (11155111)
               ▲                                │
   Indexer (Node script): scans known addresses + contract events → DB
   Organizer CLI (Hardhat scripts): provision, deploy, fund from Exchange 1
```

- **Organizer signing stays off the web server.** Deployment and Exchange 1 funding run as
  Hardhat scripts on the organizer's machine. On Sepolia, keys live in the Hardhat keystore. A
  separate deployer key deploys the contracts, so Exchange 1's history holds only scenario funding.
- **Chain allowlist.** Only chain IDs `31337` and `11155111` are accepted. The app refuses to
  start with any other configured chain; scripts check the provider's chain ID before signing;
  the frontend never switches network silently.
- **Simple auth.** Organizer-issued participant ID + password (printed on a card), hashed with
  Node `crypto.scrypt`, DB-backed sessions in an httpOnly cookie. No SIWE.
- **Server-side authorization.** Role guards on every route. When a participant reports a tx
  hash, the server fetches the receipt itself and checks the sender is the assigned wallet.

## Repository layout

```
picard/
├── contracts/        Hardhat: contracts, tests, organizer scripts (Stage 3)
├── web/              Next.js App Router app, DB migrations, indexer
├── deployments/      <chainId>.json — public addresses, deploy tx hashes, start block
├── docs/
└── .env.example
```

## Contracts (details in CONTRACTS.md)

- **ProjectFactory** (organizer-owned): `setCreatorAllowed`, `createProject(name, mintPrice,
  metadataURI)` — called by an allowed creator, one project each, deploys a `Project` owned by
  the caller. Event `ProjectCreated`.
- **Project**: immutable owner/marketplace/name/mintPrice/metadataURI. `deposit()` callable by
  the marketplace only; no `receive`. Tracks `totalReceived` / `totalWithdrawn`.
  `withdraw(amount)` owner-only, `nonReentrant`, pays the owner. Events `FundsReceived`,
  `Withdrawn`.
- **ScenarioNFT** (ERC-721): one shared collection, minted only by the marketplace,
  `projectOf(tokenId)`.
- **Marketplace**: `mint(project) payable` — requires a factory project and exact price, mints
  the NFT, forwards the full payment to `project.deposit`. Event `PaymentRouted`. No fee.

## Payment flow

```
Exchange 1 (organizer EOA)
  ├─tx: ETH (gas)──────────────► Creators C1..C5
  ├─tx: ETH (gas + mint budget)─► Investors I1..I9
  └─tx: ETH (gas)──────────────► Mule

C_k ──tx: Factory.createProject()──► deploys Project_k               [ProjectCreated]

I_j ──tx: Marketplace.mint(Project_k){value: price}
          ├─internal: ScenarioNFT.mint → I_j                         [Transfer 0x0→I_j]
          └─internal ETH: Marketplace → Project_k.deposit            [FundsReceived, PaymentRouted]

C_mal ──tx: Project_mal.withdraw(amount)
          └─internal ETH: Project_mal → C_mal                        [Withdrawn]
C_mal ──tx: plain ETH transfer (creator "Send test ETH" panel) ──► Mule
Mule  ──tx: plain ETH transfer (mule dashboard) ──► Exchange 2 (organizer EOA)
```

Internal hops (marketplace → project, project → creator) are not top-level transactions, so
events are the evidence for them. The indexer stores top-level transactions touching known
addresses (block scan from the scenario start block) and all scenario contract events.

## Data model

Application state and the blockchain mirror are kept separate. Mirror tables (`chain_txs`,
`chain_events`) are written only by the indexer from RPC data.

| Table | Purpose |
|---|---|
| `scenarios` | chain, start block, contract addresses, Exchange 1/2 |
| `participants` | ID, role, assigned wallet, password hash |
| `participant_private` | instructions, malicious flag, organizer notes (never in participant APIs except own instructions) |
| `organizers` | organizer logins |
| `sessions` | session token hashes |
| `projects` | project metadata, contract address, creation tx |
| `funding_plan` | per-role gas and scenario amounts (kept separate) |
| `funding_transfers` | Exchange 1 distribution records |
| `tx_requests` | application-side transaction tracking |
| `known_addresses` | the 17 scenario addresses with neutral public labels |
| `chain_txs`, `chain_events`, `indexer_state` | indexed blockchain data |

## Decisions

| # | Decision |
|---|---|
| D1 | Creators may withdraw at any time; owner-only; funds go to the owner. |
| D2 | Contract allows any creator to withdraw; whether honest creators do is set by instructions. |
| D3 | Every creator dashboard has an identical "Send test ETH" panel with a free-text recipient address (validated, confirmed before MetaMask). |
| D4 | Creators choose a mint price within organizer bounds; no max supply. |
| D5 | Investor instructions specify which projects and how many mints; funding sized to match. |
| D6 | One funding tx per wallet; gas vs scenario split tracked in config/docs. |
| D7 | Explorer labels: "Exchange 1", "Exchange 2", participants as "P01"… with no role. |
| D8 | Organizer generates all wallets and logins with a local script. Participants receive only a login/password card. The organizer pre-imports each wallet into MetaMask on a prepared device (Option A). Private keys never enter the app, DB, or git. |
| D9 | `tokenURI` points to an app route returning JSON. |
| D10 | Local Postgres for development; Supabase for the hosted Sepolia run. |
| D11 | Next.js on Vercel; indexer runs as a Node process on the organizer's machine, plus a "sync now" action. |
| D12 | No investor refunds. |

## Development stages

1. Inspect and plan (done)
2. App skeleton with mock blockchain data
3. Contracts and tests
4. Wallet integration
5. Participant workflows
6. Indexer and explorer
7. End-to-end local simulation of all 17 wallets
8. Sepolia deployment and rehearsal

## Implementation notes

- Next.js 16 App Router with Cache Components **off**. Every page reads the session, so pages
  render per request, and the older caching model avoids wrapping each auth check in Suspense.
- Database access uses `pg` with plain SQL migrations (`web/db/migrations`), with no ORM.
- Participant-facing queries live in `web/lib/data/participant.ts` and organizer-only queries in
  `web/lib/data/organizer.ts`, so private fields are easy to audit.
- Wallet logic lives in `web/components/wallet/` (MetaMask provider, wallet panel, transaction hook)
  with pure rules in `web/lib/wallet/`. Server-side verification of reported transactions is in
  `web/lib/tx-verify.ts`, and the RPC connection (chain-ID checked) is in `web/lib/chain.ts`.
- The indexer core (`web/indexer/core.ts`) has no Next.js imports, so the CLI runner
  (`web/scripts/indexer.ts`) and the organizer's sync route share it. Explorer queries live in
  `web/lib/explorer.ts`. Lists come from the index; single-transaction pages read the chain directly.
