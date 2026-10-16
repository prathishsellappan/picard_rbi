# Organizer guide (local run on this computer)

This guide runs the role-play on **this computer only**: a local test blockchain, the website
at `http://localhost:3000`, and the local Postgres database. Deploying to Sepolia is a separate
step, described in [SEPOLIA.md](SEPOLIA.md).

Give participants [USER-GUIDE.md](USER-GUIDE.md): Part A, their role's part, and Part E. That
guide never mentions the hidden storyline. **This** guide does, so keep it to yourself.

---

## 1. Start and stop

### Start

From the repository folder (`/Users/prathish/Desktop/picard`):

```bash
npm run local
```

It does everything in order and prints each step:

1. Checks `web/.env.local` (local chain only) and that Postgres is running, then applies
   database migrations.
2. Starts the local blockchain, or reuses one already running on port 8545.
3. Creates the local scenario if none exists: 15 participants, Exchange 1 and Exchange 2.
4. If the blockchain is fresh, it clears the old chain records, then deploys the contracts,
   approves the 5 creators and funds all 15 wallets from Exchange 1. This happens on first run
   and after every restart. **Logins and passwords stay the same.**
5. Writes the MetaMask import keys, then runs the **indexer** and the **website**.

When you see the box with **App: http://localhost:3000**, it's ready.

If it says *Can't reach Postgres*, start it with `brew services start postgresql@17` and run
`npm run local` again.

### Stop

Press **Ctrl+C** in that terminal. This stops the blockchain, indexer and website.

**Stopping erases the local blockchain**: all projects, mints and transfers are gone. The next
`npm run local` deploys fresh contracts and refunds the wallets, keeping the same logins. Two
things don't carry over:
- the off-chain project descriptions;
- MetaMask's memory of old transactions. Clear it on each prepared browser: MetaMask →
  **Settings → Advanced → Clear activity tab data**. Otherwise MetaMask reuses old nonces and
  transactions get stuck.

If you only close the website tab, nothing stops. The terminal keeps everything running.

---

## 2. Your secret files

Everything private is in `organizer-secrets/`. It is never committed to git, and the files are
readable only by your Mac user.

| File | Contents | Use |
|---|---|---|
| `credentials-local.csv` | `login,password` for P01–P15 and `organizer` | Print one **login card** per participant. Keep the organizer line to yourself. |
| `local-wallet-keys.csv` | For every wallet: role, address, private key | Import each participant's key into MetaMask on their browser (section 3). |

The local keys are Hardhat's public development keys. They only work on this local chain and
have no value anywhere else. Sepolia keys are different and come from `npm run provision` (see
[SEPOLIA.md](SEPOLIA.md)).

To issue **new** passwords, stop `npm run local`, run `npm run db:seed -- --reset`, then start
again. This also clears the scenario's settings and instructions back to the defaults.

Default roles (P01–P05 creators, P06–P14 investors, P15 mule):

| Login | Role | Wallet (Hardhat account) |
|---|---|---|
| P01–P05 | Creator | accounts 1–5 |
| P06–P14 | Investor | accounts 6–14 |
| P15 | Mule | account 15 |
| Exchange 1 | Organizer: funding source | account 0 |
| Exchange 2 | Organizer: final destination | account 16 |

The **malicious creator** is **P03** by default. Change it on the **Participants** page.

---

## 3. Preparing a browser for each participant

Each participant needs their own browser with MetaMask holding **only their** wallet. On a
single computer, use one **Chrome profile per participant** (Chrome → profile icon → **Add**).

In each profile:

1. Install the **MetaMask** extension and create a MetaMask password for the profile. Write it
   on that participant's card; it isn't the website password.
2. Add the local network: MetaMask → network menu → **Add a custom network**:
   - Network name: `Local Hardhat`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`

   Alternatively, after logging in, click **Switch to Local Hardhat** in the wallet panel; it
   offers to add the network.
3. Import the wallet: MetaMask → account menu → **Add account or hardware wallet → Import
   account** → paste that participant's `private_key` from `local-wallet-keys.csv`. Rename the
   account to the login, for example `P07`.
4. Open `http://localhost:3000`, log in with the participant's card, click **Connect MetaMask**
   and check the panel turns green: *Assigned wallet connected*.

Every wallet starts with about 10,000 test ETH on the local chain, because Hardhat
pre-funds its dev accounts. The Exchange 1 funding still shows up on-chain as evidence, but it
doesn't limit what participants can spend locally. Fresh wallets on Sepolia start at zero.

---

## 4. Logging in as the organizer

Open `http://localhost:3000` and log in with login **`organizer`** and the organizer password from
`credentials-local.csv`. The menu shows **Overview**, **Participants**, **Scenario** and **Explorer**.

### 4.1 Overview

- **Participants**: how many creators, investors and mules there are, and **which creator is
  malicious**. Only you see this.
- **Exchanges**: the Exchange 1 and Exchange 2 addresses.
- **Initial funding plan**: gas and scenario funds per role, and the total Exchange 1 needs.
- **Participant progress (from the chain index)**: one row per participant, built from what
  actually happened on the blockchain, not from what the website recorded:
  - Funded: Exchange 1 sent them their funding.
  - Project: the creator has created a project.
  - Mints: how many NFTs the investor minted.
  - Withdrawn: how much the creator withdrew from their project.
  - Sent / Received: ordinary ETH transfers (Received excludes the initial funding).
  - Last tx block: when they last sent a transaction.
- **Sync index now**: updates the index immediately. The indexer in the terminal also updates it
  every few seconds.
- **Contracts**: the deployed ProjectFactory, Marketplace and ScenarioNFT addresses.

### 4.2 Participants

Each participant has a card. Click **Save** after changing anything.

| Field | Notes |
|---|---|
| ID | Fixed, for example `P07`. |
| Display name | Shown on that participant's dashboard ("Welcome, …"). |
| Role | creator / investor / mule. |
| Assigned wallet | The address their MetaMask must use. Change it before the contracts are deployed (see below). |
| Instructions | **Shown only to this participant**, in their *Your instructions* panel. Put their briefing here. |
| Organizer notes | Never shown to participants. |
| Malicious creator | Only one creator should have it. Never shown to participants or in the explorer. |

- **Reset password** gives that participant a new password, shown once, and logs them out.
- **Add participant** creates a new login; its password is shown once.

If you change a creator's wallet after deployment, approve the new wallet on the factory with
`npm run register-creators:local -w contracts`. A new wallet also needs funding:
`npm run fund:local -w contracts` funds wallets that haven't been funded yet.

### 4.3 Scenario

- **Exchange addresses**: Exchange 1 is the funding source, Exchange 2 the final destination.
- **Mint price bounds**: copied into the factory contract **when it is deployed**. Changing them
  afterwards affects only the next deployment, after a restart.
- **Initial funding per wallet**: gas money and scenario funds per role. They're applied when
  wallets are funded, on the next fresh start.

---

## 5. Running a session

### 5.1 Suggested instructions

Write these in each participant's **Instructions** field, adapted to your lesson:

- **Honest creators (P01, P02, P04, P05):** "Create a project with an attractive name and
  description. Set a mint price. Withdraw or don't, as your briefing says."
- **Malicious creator (default P03):** "Create a convincing project. When investors have minted,
  withdraw everything using **Withdraw funds → Max**. Then use **Send test ETH** to send the full
  amount to this address: `<the mule's wallet address>`." Copy the mule's address from the
  **Participants** page or the Explorer, since the creator needs it.
- **Investors (P06–P14):** "Mint NFTs from the projects named here: …" Naming the malicious
  project for several investors makes the money trail clearer.
- **Mule (P15):** "When test ETH arrives in your wallet, forward it with **Transfer to
  Exchange 2 → Max**."

The malicious creator's dashboard looks exactly like the others. Every creator has the same
**Send test ETH** panel, so nothing on screen gives the role away.

### 5.2 Order of play

1. Run `npm run local` and wait for the ready box.
2. Everyone logs in and connects MetaMask. Watch the progress table: **Funded** should say *yes*
   for everyone.
3. Creators create their projects (**Project** → *created*).
4. Investors mint (**Mints** goes up).
5. The malicious creator withdraws and sends the funds to the mule (**Withdrawn**, **Sent**).
6. The mule forwards them to Exchange 2 (**Received**, **Sent** on P15).
7. Debrief with the **Explorer**:
   - open the malicious project's address page: the mint payments arrive under *Internal ETH
     movements*, and then one *Project withdrawal* goes out;
   - follow the creator's outgoing transfer to the mule, then the mule's transfer to Exchange 2;
   - open any transaction to show its decoded events.

### 5.3 Monitoring

- **Overview → Participant progress** for who has done what.
- **Explorer → Latest scenario transactions** for everything as it happens.
- The terminal running `npm run local` prints `[indexer] up to block …` as new blocks arrive,
  and `[web]` lines for website errors.

---

## 6. Resetting

| You want to… | Do this |
|---|---|
| Start over with the same logins | Ctrl+C, then `npm run local`. Fresh chain and contracts, same passwords. Clear MetaMask activity data. |
| New passwords and default settings | Ctrl+C, `npm run db:seed -- --reset`, then `npm run local`. Reprint the cards. |
| Fresh wallets instead of Hardhat's dev accounts | `npm run provision -- --name "…" --exchange1 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --replace`. Keys go to `organizer-secrets/scenario-*-wallets.json`. Then Ctrl+C and `npm run local`. |
| Check that everything is set up correctly | `npm run preflight:local -w contracts` (read-only PASS/WARN/FAIL report). |

---

## 7. Command reference

Run these from the repository folder.

| Command | What it does |
|---|---|
| `npm run local` | Start everything (section 1). |
| `npm run db:seed -- --reset` | New local scenario: new passwords, default settings. |
| `npm run indexer -- --once` | Index up to the current block and exit. |
| `npm run preflight:local -w contracts` | Read-only readiness check. |
| `npm run register-creators:local -w contracts` | Approve creators on the factory (skips ones already approved). |
| `npm run fund:local -w contracts` | Fund wallets that haven't been funded yet. |
| `npm test` | The automated tests, including the full 17-wallet simulation. Uses a separate test database. |

---

## 8. Good to know

- **Only you** see roles, the malicious flag, organizer notes and other participants'
  instructions. The explorer labels wallets only as `P01`…`P15` and `Exchange 1/2`.
- Participants can't change their role or wallet. The server decides both from their login,
  and it checks on the blockchain that every transaction they report came from their assigned
  wallet.
- The website runs on this computer. Other devices on the same network could open it at the
  "Network" address shown in the terminal. Their MetaMask would then need this computer's
  address instead of `127.0.0.1` to reach the chain. For tomorrow's deployment, use
  [SEPOLIA.md](SEPOLIA.md) instead.
