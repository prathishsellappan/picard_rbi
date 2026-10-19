# Picard — crypto-fraud role-play (testnet only)

An educational role-play that walks 15 participants through a simulated NFT-project fraud on a
local Ethereum network or Sepolia, leaving public on-chain evidence for a later investigation.
The scenario re-enacts the **Frosties** NFT case (January 2022). Its explorer names follow the
PICARD lab: `Contract creator`, `Frosties contract`, `Buyer 1`…, and an unnamed second wallet.
**Test assets only. Nothing here has monetary value. Mainnet is refused.**

## Run it on this computer

```bash
npm install
npm run local
```

Then open http://localhost:3000. To let other devices on the same Wi-Fi join, use `npm run local:lan` instead (see the organizer guide). You need Postgres running (`brew services start postgresql@17`).
Login cards are in `organizer-secrets/credentials-local.csv`.

- How to use the website, per role (shareable with participants): [docs/USER-GUIDE.md](docs/USER-GUIDE.md)
- Running a session as the organizer: [docs/ORGANIZER-GUIDE.md](docs/ORGANIZER-GUIDE.md)
- Setting it up on another laptop (Windows or macOS, runs offline): [docs/PORTABLE-SETUP.md](docs/PORTABLE-SETUP.md)
- Running it with Docker (any machine, including AWS): [docs/DOCKER.md](docs/DOCKER.md)

## Documentation

- Architecture, contract design, payment flow, and decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Contracts, permissions, events: [docs/CONTRACTS.md](docs/CONTRACTS.md)
- Local setup and running: [docs/SETUP.md](docs/SETUP.md)
- Putting it online (Vercel + Supabase + Sepolia), step by step for beginners: [docs/DEPLOY-STEP-BY-STEP.md](docs/DEPLOY-STEP-BY-STEP.md)
- Sepolia deployment, budget and rehearsal runbook: [docs/SEPOLIA.md](docs/SEPOLIA.md)
- Project rules for contributors and Claude Code: [CLAUDE.md](CLAUDE.md)

## Status

| Stage | State |
|---|---|
| 1. Plan | done |
| 2. App skeleton (mock blockchain data) | done |
| 3. Smart contracts and organizer scripts | done |
| 4. Wallet integration and transaction status | done |
| 5. Participant workflows (projects, minting, withdrawal) | done |
| 6. Indexer and explorer | done |
| 7. End-to-end simulation (17 wallets) | done |
| 8. Sepolia deployment and rehearsal | tooling and runbook ready; needs organizer accounts, keys and test ETH |
