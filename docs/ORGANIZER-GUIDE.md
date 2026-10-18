# Organizer guide (local run on this computer)

This guide runs the role-play on **this computer only**: a local test blockchain, the website
at `http://localhost:3000`, and the local Postgres database. Deploying to Sepolia is a separate
step, described in [SEPOLIA.md](SEPOLIA.md).

Give participants [USER-GUIDE.md](USER-GUIDE.md): Part A, their role's part, and Part E. That
guide never mentions the hidden storyline. **This** guide does, so keep it to yourself.

---

## 0. The Frosties case

The role-play re-enacts **Frosties**, a real NFT "rug pull" on Ethereum mainnet:
- **9 January 2022:** the collection sold out at 0.04 ETH per token. The owner withdrew the
  proceeds (356.56 ETH) and, within a minute, sent 358 ETH to a fresh second wallet.
- **11–14 January 2022:** that second wallet put 345 ETH into Tornado Cash in fixed 100/10/1 ETH
  deposits.

The PICARD lab teaches investigators to follow exactly this trail.

| In the case (PICARD lab name) | In this role-play | Explorer label |
|---|---|---|
| Frosties contract | the Frosties project created by `frosties` (P01) | `Frosties contract` |
| Contract creator (owner) | `frosties` (P01), the malicious creator | `Contract creator` |
| Second wallet (unnamed in the lab) | `mule` (P15) | *no label*, address only |
| The buyers, including "the Buyer" the lab starts from | `buyer1`–`buyer9`; `buyer1` can play "the Buyer" | `Buyer 1`–`Buyer 9` |
| High-volume service wallet (an exchange) | Exchange 1, which funds everyone | `Exchange (service wallet)` |
| Tornado Cash router (mixer) | Exchange 2, a plain organizer wallet; **no mixer is built** | `Tornado Cash (mixer stand-in)` |
| other NFT projects of the time | `creator1`–`creator4`: ordinary decoy projects | `Creator 1`–`Creator 4`, `<name> contract` |

Prices: the real 0.04 ETH locally; 0.004 ETH on Sepolia, where test ETH is scarce.

### Ground rules when presenting the case

These follow the case guide used by the PICARD-BRICS team:
- **Ledger facts vs allegations.** A ledger fact is what the blockchain records, with a
  transaction hash anyone can check. An allegation comes from the charging documents, which
  charged two men with conspiracy to commit wire fraud and money laundering. Say which one
  you're presenting.
- **No outcome.** No plea, conviction or sentence had been found in a primary source as of
  October 2026. Don't say the defendants were convicted or pleaded guilty.
- **The address identifications are the team's own work**, not a DOJ statement.
- **Don't label people the complaint doesn't name.** For example, wallets that received small
  payments aren't "accomplices".
- **This role-play uses test wallets and fictional participants.** Don't put the defendants' names
  or the real mainnet addresses into the app.
- If you show the real mainnet ledger data, credit it: "Powered by Etherscan.io APIs".

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
3. Creates the local Frosties scenario if none exists: 15 participants, Exchange 1 and Exchange 2.
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
| `credentials-local.csv` | `login,password,role,participant_id` for every participant and `organizer` | Print one **login card** per participant (login and password). Keep the organizer line to yourself. |
| `local-wallet-keys.csv` | For every wallet: login, participant ID, role, address, private key | Import each participant's key into MetaMask on their browser (section 3). |

The local keys are Hardhat's public development keys. They only work on this local chain and
have no value anywhere else. Sepolia keys are different and come from `npm run provision` (see
[SEPOLIA.md](SEPOLIA.md)).

To issue **new** passwords, stop `npm run local`, run `npm run db:seed -- --reset`, then start
again. This also clears the scenario's settings and instructions back to the defaults.

Each participant has a login, a display name, an internal **participant ID** (P01–P15) and a
public **explorer label**. You can edit all of them on the **Participants** page.

| Login | Display name | ID | Role | Explorer label | Wallet (Hardhat account) |
|---|---|---|---|---|---|
| `frosties` | Frosties creator | P01 | Creator (malicious) | Contract creator | account 1 |
| `creator1`–`creator4` | Creator 1–4 | P02–P05 | Creator | Creator 1–4 | accounts 2–5 |
| `buyer1`–`buyer9` | Buyer 1–9 | P06–P14 | Investor | Buyer 1–9 | accounts 6–14 |
| `mule` | Second wallet | P15 | Mule | *(none)* | account 15 |
| `organizer` | — | — | Organizer | — | — |
| — | — | — | Exchange 1, funding source | Exchange (service wallet) | account 0 |
| — | — | — | Exchange 2, final destination | Tornado Cash (mixer stand-in) | account 16 |

The **malicious creator** is **`frosties` (P01)** by default. The malicious flag, roles and
briefings are never shown in the explorer.

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
   offers to add the network. If MetaMask refuses, the panel shows these same settings for adding
   it by hand.

   **Common trap:** MetaMask may already have a network called *Localhost 8545* that uses the
   same RPC URL but chain ID **1337**. Selecting it still shows "wrong network". MetaMask may also
   refuse the new network because the URL is already in use. Fix it by editing that existing
   network and setting its chain ID to **31337**, or delete it and add `Local Hardhat` as above.
3. Import the wallet: MetaMask → account menu → **Add account or hardware wallet → Import
   account** → paste that participant's `private_key` from `local-wallet-keys.csv`. Rename the
   account to the login, for example `buyer2`.
4. Open `http://localhost:3000`, log in with the participant's card, click **Connect MetaMask**,
   and in the MetaMask window tick **only** that participant's account. Check the panel turns
   green: *Assigned wallet connected*. If it says *connected to a different account*, click
   **Choose account in MetaMask** and pick the right one.

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
- **Contracts**: the deployed ProjectFactory, Marketplace and NFT collection (ScenarioNFT) addresses.

### 4.2 Participants

Each participant has a card. Click **Save** after changing anything.

| Field | Notes |
|---|---|
| ID | Fixed internal participant ID, for example `P07`. |
| Login username | What the participant types to log in, for example `buyer2` (lowercase letters and digits). |
| Display name | Shown on that participant's dashboard ("Welcome, …") and in the top bar. |
| Explorer label | The public name of this wallet in the explorer, for example `Buyer 3`. Leave it **empty** to show only the address, as for the second wallet. Never put a role or the storyline here. |
| Role | creator / investor / mule. |
| Assigned wallet | The address their MetaMask must use. Change it before the contracts are deployed (see below). |
| Instructions | **Shown only to this participant**, in their *Your instructions* panel. Put their briefing here. |
| Organizer notes | Never shown to participants. |
| Malicious creator | Only one creator should have it. Never shown to participants or in the explorer. |

- **Reset password** gives that participant a new password, shown once, and logs them out.
- **Add participant** creates a new login (ID, username, role, wallet); its password is shown once.

If you change a creator's wallet after deployment, approve the new wallet on the factory with
`npm run register-creators:local -w contracts`. A new wallet also needs funding:
`npm run fund:local -w contracts` funds wallets that haven't been funded yet.

### 4.3 Scenario

- **Exchange addresses and explorer labels**: Exchange 1 is the funding source (`Exchange (service
  wallet)`), Exchange 2 the final destination (`Tornado Cash (mixer stand-in)`). The second
  wallet's dashboard shows Exchange 2's label on its transfer button.
- **Mint price bounds**: copied into the factory contract **when it is deployed**. Changing them
  afterwards affects only the next deployment, after a restart.
- **Initial funding per wallet**: gas money and scenario funds per role. They're applied when
  wallets are funded, on the next fresh start.

---

## 5. Running a session

### 5.1 Briefings (pre-filled)

Every participant already has a Frosties briefing in their **Instructions** field. Edit them on
the **Participants** page if you want to.

- **`frosties` (P01):**
  - create "Frosties" at 0.04 ETH, with a description promising giveaways, early access to a
    metaverse game and mint passes;
  - after the buyers have minted, **Withdraw funds → Max**;
  - straight away, **Send test ETH** the whole amount to the second wallet. Its address is
    already filled into the briefing.
- **`creator1`–`creator4`:** run an ordinary project of their own, with a name, a description
  and a price between 0.01 and 0.05 ETH.
- **`buyer1`–`buyer9`:** mint one Frosties NFT and one from any other project.
- **`mule`:** when ETH arrives, forward it with **Transfer to Tornado Cash (mixer stand-in)**,
  in a few round amounts like the case's fixed-size mixer deposits, keeping a little for gas.

The Frosties creator's dashboard looks exactly like the other creators'. Every creator has the
same **Send test ETH** panel, so nothing on screen gives the role away.

### 5.2 Order of play

1. Run `npm run local` and wait for the ready box.
2. Everyone logs in and connects MetaMask. Watch the progress table: **Funded** should say *yes*
   for everyone.
3. `frosties` and the four creators create their projects (**Project** → *created*).
4. The buyers mint. **Mints** goes up, mostly on Frosties: this is the 9 January sell-out.
5. `frosties` withdraws everything and sends it to the second wallet (P01: **Withdrawn**, **Sent**).
6. The second wallet forwards it in round amounts to the mixer stand-in (P15: **Received**, **Sent**).
7. Debrief with the **Explorer**. This follows the PICARD lab's chapters:
   1. **Where did one buyer's payment go?** Open `Buyer 1`: its mint went to the `Marketplace`
      and on to the `Frosties contract`, shown as *Internal ETH movements*.
   2. **Follow the withdrawal.** On `Frosties contract`, the mint payments come in and one
      *Project withdrawal* goes out to `Contract creator`. Then follow the creator's outgoing
      transfer to an **unlabelled address** (the second wallet), and from there the round-amount
      transfers into `Tornado Cash (mixer stand-in)`.
   3. **What does the evidence support?** Separate the ledger facts (amounts, times, hashes) from
      what they suggest. Ask: who controls the second wallet, and what would an investigator
      request next, for example from the exchange that funded the creator?

   Open any transaction to show its decoded events and the exact block and time.

### 5.3 Monitoring

- **Overview → Participant progress** for who has done what. Each row shows the participant ID
  and login.
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
  instructions. The explorer shows only the explorer labels you set. The second wallet has none,
  so it appears as an address, just as in the PICARD lab.
- Participants can't change their role or wallet. The server decides both from their login,
  and it checks on the blockchain that every transaction they report came from their assigned
  wallet.
- The website runs on this computer. Other devices on the same network could open it at the
  "Network" address shown in the terminal. Their MetaMask would then need this computer's
  address instead of `127.0.0.1` to reach the chain. For tomorrow's deployment, use
  [SEPOLIA.md](SEPOLIA.md) instead.
