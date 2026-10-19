# Deploying the role-play online: step by step

This puts the PICARD role-play on the internet:
- the **website** on Vercel;
- the **database** on Supabase;
- the **blockchain** on **Ethereum Sepolia**, the public test network.

Participants can then join from any laptop with a browser and MetaMask, from anywhere. Your Mac
is only needed for the organizer commands.

**Cost: nothing.** Every service below has a free tier. Sepolia ETH is free test money from
"faucets". **Never buy Sepolia ETH, and never pay a faucet.**

**Time:** about 1–2 hours of clicking, plus however long the faucets take. Start step 3 early.

**Golden rule for secrets.** Private keys, passwords, API keys and connection strings go **only**
into the places this guide names: `web/.env.sepolia`, the Hardhat keystore and Vercel's settings.
Never into chat, email or a document. Public addresses (`0x…`) and website links are fine to share.

---

## Overview

| # | Step | Who | Time |
|---|---|---|---|
| 1 | Make the GitHub repo private | you | 1 min |
| 2 | Create two organizer wallets in MetaMask | you | 3 min |
| 3 | Collect Sepolia test ETH | you | 15 min – 1 day |
| 4 | Alchemy: get a Sepolia connection URL | you | 5 min |
| 5 | Etherscan: get an API key | you | 3 min |
| 6 | Supabase: create the database | you | 10 min |
| 7 | Fill in `web/.env.sepolia` | you | 5 min |
| 8 | Store the organizer keys in the Hardhat keystore | you | 5 min |
| 9 | Commit and push the code | Claude / you | 2 min |
| 10 | Vercel: put the website online | you | 10 min |
| 11 | Create the database tables | terminal | 1 min |
| 12 | Create the scenario: wallets and login cards | terminal | 1 min |
| 13 | Preflight check | terminal | 1 min |
| 14 | Deploy the contracts | terminal | 2 min |
| 15 | Verify the contracts on Etherscan | terminal | 2 min |
| 16 | Approve the creators and fund the 15 wallets | terminal | 5 min |
| 17 | Start the indexer | terminal | ongoing |
| 18 | Prepare the participants' MetaMask | you | 3 min per device |
| 19 | Rehearse | everyone | 20 min |
| 20 | The live run: a fresh scenario | terminal | 10 min |

"Terminal" means **Terminal** on this Mac, in the project folder:

```bash
cd /Users/prathish/Desktop/picard
```

Commands from step 13 on ask for the **keystore password** you create in step 8.

---

## Step 1 — Make the GitHub repo private

**Why:** Vercel builds the website from your GitHub repo. The guides inside it reveal the
storyline (who the malicious creator is), so participants must not be able to read it.

1. Open https://github.com/prathishsellappan/picard_rbi.
2. **Settings** → scroll to **Danger Zone** → **Change repository visibility** → **Make private**.
   If it already says "Make public", it's private and you're done.

---

## Step 2 — Create two organizer wallets in MetaMask

**Why:** two organizer roles sign transactions on Sepolia:
- **Deployer:** puts the contracts on the blockchain and approves the creators.
- **Exchange 1:** the "service wallet" that hands out test ETH to all 15 participants, like the
  exchange in the Frosties case.

They're kept separate so that Exchange 1's public history shows only the role-play funding.

1. Open MetaMask → the account menu at the top → **Add account** → **Create a new account**
   (not "Import").
2. Name it `PICARD Deployer`.
3. Repeat, and name the second one `PICARD Exchange 1`.
4. Copy each one's **public address** (the `0x…` under the name, copy icon) into a note. You'll
   need both.

These accounts come from your own MetaMask recovery phrase, so only you control them. **Don't**
use the imported `creator1`/`investor1`/`mule1` accounts: those are public test keys and any ETH
sent to them is stolen by bots within seconds.

---

## Step 3 — Collect Sepolia test ETH (start this early)

**Why:** every blockchain action costs a little "gas", paid in ETH. On Sepolia that ETH is free,
but faucets hand it out slowly to stop abuse.

**How much** (default plan):

| Wallet | Amount | Used for |
|---|---|---|
| PICARD Deployer | **about 0.15 ETH** | deploying the 3 contracts, approving 5 creators |
| PICARD Exchange 1 | **about 0.6 ETH** | 0.53 ETH of funding for the 15 participants, plus gas |

**Where to get it:** try several and keep their tabs open.
- **Google Cloud Web3 faucet:** search "Google Cloud Ethereum Sepolia faucet", sign in with
  Google, and paste the wallet address.
- **Sepolia PoW faucet** (`sepolia-faucet.pk910.de`): paste the address and let it "mine" in the
  browser tab for a while, then claim.
- **Alchemy faucet** and **Infura faucet:** they need an account; some ask that the wallet holds
  a little real mainnet ETH. That's only a check, nothing is spent. Skip any that ask you to pay.

**Check the balance:** in MetaMask, turn on test networks (network menu → **Show test networks**)
and select **Sepolia**. Or paste the address into https://sepolia.etherscan.io.

You can carry on with steps 4–12 while you wait. You need the ETH from step 13 onwards.

---

## Step 4 — Alchemy: a Sepolia connection URL

**Why:** the website and the organizer scripts talk to the blockchain through an "RPC" service.
Alchemy provides one for free.

1. Go to https://www.alchemy.com and sign up (free).
2. **Create new app** → name `picard` → chain **Ethereum** → network **Sepolia** → create.
3. Open the app → **Endpoints** / **API key** → copy the **HTTPS** URL. It looks like
   `https://eth-sepolia.g.alchemy.com/v2/AbC123…`.
4. **Keep it private.** It contains your key. It goes into step 7, step 8 and step 10 only.

---

## Step 5 — Etherscan: an API key

**Why:** "verifying" the contracts publishes their source code on Etherscan, so investigators
(and the future investigation app) can read exactly what the contracts do.

1. Go to https://etherscan.io and sign up (free).
2. Account menu → **API Keys** → **Add** → name `picard` → copy the key.

The same key works for Sepolia.

---

## Step 6 — Supabase: the database

**Why:** logins, scenario settings and the indexed blockchain history live in a PostgreSQL
database. Supabase hosts one for free.

1. Go to https://supabase.com, sign up, then **New project**.
   - Name: `picard`. Region: **Mumbai (ap-south-1)**, the closest to you.
   - **Database password:** click **Generate**, then **copy it into your password manager now**.
     You'll need it in step 7.
   - Create, and wait about 2 minutes while it starts.
2. **Connection string:** click **Connect** (top of the project) → **Connection string** → the
   **Transaction pooler** option (port **6543**). Copy the URI. It looks like
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`.
   Replace `[YOUR-PASSWORD]` with your database password.
   - If the password contains special characters such as `@ : / ? # %`, they must be
     "URL-encoded" (for example `@` becomes `%40`). The easiest fix is to regenerate a password
     with only letters and numbers.
3. **SSL certificate:** **Project Settings** → **Database** → **SSL Configuration** → **Download
   certificate**. You get a file like `prod-ca-2021.crt` in `Downloads`.
   - **Why:** Supabase signs its connections with its own certificate authority. Giving the app
     this file lets it check it is really talking to your database, not just that the line is
     encrypted.
4. **Free-tier note:** a free project **pauses after about a week without use**. Before an
   event, open the Supabase dashboard; if it says *Paused*, click **Restore**.

---

## Step 7 — Fill in `web/.env.sepolia`

**Why:** this file holds the Sepolia settings for the organizer commands on your Mac. It's
separate from `web/.env.local`, so your **local demo keeps working**. Git ignores it, so it's
never uploaded.

1. Turn the certificate into a single line the file can hold. In Terminal, check the filename in
   Downloads and adjust it if needed:
   ```bash
   awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' ~/Downloads/prod-ca-2021.crt | pbcopy
   ```
   That copies the certificate, as one line with `\n` between lines, to the clipboard.
2. Open the file:
   ```bash
   open -e /Users/prathish/Desktop/picard/web/.env.sepolia
   ```
3. Fill in each line, leaving nothing in `<…>`:

   | Line | Put here |
   |---|---|
   | `NEXT_PUBLIC_CHAIN_ID=11155111` | leave as is (Sepolia's chain ID) |
   | `RPC_URL=` | the Alchemy HTTPS URL from step 4 |
   | `DATABASE_URL=` | the Supabase pooler URI from step 6, with your password in it |
   | `DATABASE_SSL_CA=` | paste the clipboard from point 1 (a long line starting `-----BEGIN CERTIFICATE-----\n`) |
   | `NFT_BASE_URI=` | `https://<your-vercel-project>.vercel.app/api/nft/`. Choose the project name now (for example `picard-roleplay`) and use the same name in step 10. |
   | `SESSION_TTL_HOURS=12` | leave as is |

4. Save and close.

---

## Step 8 — Store the organizer keys in the Hardhat keystore

**Why:** the deploy and funding scripts must sign transactions as the Deployer and Exchange 1.
Their private keys go into Hardhat's **encrypted** keystore on your Mac, never into a file in
the project.

1. Get each private key from MetaMask: select the account → **⋮** → **Account details** → **Show
   private key** → enter your MetaMask password → copy. Do this one at a time, just before
   pasting it into Terminal.
2. In Terminal:
   ```bash
   cd /Users/prathish/Desktop/picard/contracts
   npx hardhat keystore set SEPOLIA_RPC_URL
   npx hardhat keystore set SEPOLIA_DEPLOYER_PRIVATE_KEY
   npx hardhat keystore set SEPOLIA_EXCHANGE1_PRIVATE_KEY
   npx hardhat keystore set ETHERSCAN_API_KEY
   cd ..
   ```
   - The **first** command asks you to create a **keystore password**. Choose one and remember it,
     because every Sepolia command asks for it.
   - Each command then asks for the value: the Alchemy URL, the Deployer's private key, the
     Exchange 1 private key, and the Etherscan key.
3. Check: `npx hardhat keystore list` (inside `contracts/`) shows the 4 names. It never shows the values.

---

## Step 9 — Commit and push the code

**Why:** Vercel builds the website from GitHub, so the latest code must be there.

Ask Claude to "commit and push", or run:

```bash
cd /Users/prathish/Desktop/picard
git add -A
git commit -m "Prepare Sepolia deployment"
git push origin main
```

`git status` must not list `web/.env.sepolia`, `web/.env.local` or `organizer-secrets/`. They are
gitignored; if they ever appear, stop and ask.

---

## Step 10 — Vercel: put the website online

**Why:** Vercel runs the Next.js website on the internet and gives it a public HTTPS address.

1. Go to https://vercel.com → **Sign up with GitHub** (free "Hobby" plan).
2. **Add New… → Project** → find `picard_rbi` → **Import**. If it isn't listed, click **Adjust
   GitHub App Permissions** and give Vercel access to that repo.
3. On the configure screen:
   - **Project Name:** the name you chose in step 7, for example `picard-roleplay`.
   - **Root Directory:** **Edit** → choose `web`. Keep "Include files outside the root directory
     in the Build Step" switched on, because the project is an npm workspace.
   - **Framework Preset:** Next.js (detected automatically).
   - **Environment Variables:** add each of these:

     | Name | Value |
     |---|---|
     | `NEXT_PUBLIC_CHAIN_ID` | `11155111` |
     | `RPC_URL` | the Alchemy HTTPS URL |
     | `DATABASE_URL` | the Supabase pooler URI with the password |
     | `DATABASE_SSL_CA` | the certificate: paste the `.crt` file's text as is (multi-line is fine here) or the one-line version |
     | `SESSION_TTL_HOURS` | `12` |

4. Click **Deploy** and wait 1–3 minutes.
5. Open the address Vercel shows, for example `https://picard-roleplay.vercel.app`. You should see
   the PICARD **Role-play login** with the testnet strip at the top saying **Sepolia**. You can't log in yet,
   because the database is still empty (steps 11–12).
6. If the address isn't the one you put in `NFT_BASE_URI` in step 7, fix the step 7 file now,
   before step 14.

If the build fails, copy the red error lines from Vercel's build log and send them to Claude.
They contain no secrets.

---

## Step 11 — Create the database tables

**Why:** the empty Supabase database needs the app's tables (participants, sessions, the chain
index…).

```bash
npm run sepolia -- db:migrate
```

`npm run sepolia -- …` runs the command with the settings from `web/.env.sepolia`. Expect
`applied 001…`, `applied 002…`, and so on, then `migrations up to date`.

- `self-signed certificate` error: check `DATABASE_SSL_CA` in step 7.
- `password authentication failed`: check the password in `DATABASE_URL`.

---

## Step 12 — Create the scenario: wallets and login cards

**Why:** this generates **15 fresh participant wallets** plus Exchange 2 (the "Tornado Cash"
stand-in). It stores only their public addresses in the database and writes the private keys
and login cards to your Mac.

Replace the address with your **PICARD Exchange 1** address from step 2:

```bash
npm run sepolia -- provision -- --name "Frosties – Sepolia" --exchange1 0xYOUR_EXCHANGE1_ADDRESS
```

It creates:
- `organizer-secrets/scenario-<id>-chain-11155111-wallets.json`: every participant's private key,
  plus Exchange 2's. **Keep this private.**
- `organizer-secrets/scenario-<id>-chain-11155111-login-cards.csv`: logins and passwords for the
  cards, including the **organizer** password, since this database had no organizer yet.

Logins: `frosties` (the Frosties creator, secretly malicious), `creator1`–`creator4`,
`buyer1`–`buyer9`, `mule` and `organizer`. You can now log in to the Vercel site as `organizer`.
In **Participants**, edit the briefings if you want to. Don't change the **Scenario** prices
after step 14.

---

## Step 13 — Preflight check (read-only)

**Why:** it checks everything **before** anything is spent: the right chain, the right
Exchange 1, enough ETH, and a sensible funding plan.

```bash
npm run sepolia -- preflight:sepolia -w contracts
```

Enter the keystore password. Read the list:
- **PASS**: fine.
- **WARN**: read it. "contracts not deployed yet" is expected at this point.
- **FAIL**: fix it before going on. Typical causes: not enough Sepolia ETH yet (go back to step 3),
  the Exchange 1 key doesn't match the address used in step 12, or `NFT_BASE_URI` still points to
  localhost.

---

## Step 14 — Deploy the contracts

**Why:** this puts the three role-play contracts on Sepolia: the NFT collection, the project
factory and the marketplace. They're compiled with the optimized "production" settings, which
step 15 needs.

```bash
npm run sepolia -- deploy:sepolia -w contracts
```

It prints the three addresses and writes `deployments/11155111.json`. Commit that file; it's
public information that the investigation app will use:

```bash
git add deployments/11155111.json && git commit -m "Sepolia deployment" && git push origin main
```

---

## Step 15 — Verify the contracts on Etherscan

**Why:** it publishes the source code next to each contract on sepolia.etherscan.io, so anyone
can check what the code does.

```bash
npm run sepolia -- verify:sepolia -w contracts
```

Expect `verified ScenarioNFT …`, `verified ProjectFactory …` and `verified Marketplace …`. **Run it
again after the creators have created their projects**, so the five project contracts are
verified too.

---

## Step 16 — Approve the creators and fund the 15 wallets

**Why:** only approved creators may create projects. Then Exchange 1 sends each participant
their starting test ETH: creators 0.05, buyers 0.02 + 0.01, mule 0.01.

```bash
npm run sepolia -- register-creators:sepolia -w contracts
npm run sepolia -- fund:sepolia -w contracts
npm run sepolia -- preflight:sepolia -w contracts
```

Each funding line ends in `confirmed`. Sepolia takes about 12 seconds per block, so this takes
a few minutes. Both commands are safe to run again; they skip what's already done. The last
preflight should report **"No blocking problems found."**

---

## Step 17 — Start the indexer

**Why:** a normal blockchain connection can't list "all transactions of an address". The
indexer copies the role-play's activity into the database for the explorer, the progress table
and the mule's incoming list.

Leave this running on your Mac for the whole session:

```bash
npm run sepolia -- indexer
```

It stays 3 blocks behind the newest block on purpose (about 36 seconds), so a small reorg can't
leave wrong rows. **If your Mac isn't with you:** as the organizer, press **Sync index now** on the
website's Overview page from time to time. It runs the same indexer on the server. The terminal
indexer is smoother for a live session.

---

## Step 18 — Prepare each participant's MetaMask

**Why:** each participant signs with their own assigned wallet.

On each participant's laptop (or in a separate browser profile for each):
1. Install MetaMask and create a MetaMask password for that device.
2. Network menu → **Show test networks** → select **Sepolia**.
3. **Add account → Import account** → paste that participant's `privateKey` from the
   `…-wallets.json` file of step 12 → rename the account to the login (for example `buyer3`).
4. Give them their **login card**: login and password from the `…-login-cards.csv` file.
5. They open the Vercel address, log in, and click **Connect MetaMask**.

Send each key only to its own participant's device, and remove it after the event.

---

## Step 19 — Rehearse

Run the whole story once, following [ORGANIZER-GUIDE.md](ORGANIZER-GUIDE.md) section 5.2:
1. `frosties` creates **Frosties** at **0.004 ETH**, the Sepolia price.
2. Buyers mint.
3. `frosties` withdraws (**Max**) and sends the amount to the second wallet's address, which is
   in their briefing.
4. `mule` sends it to **Tornado Cash (mixer stand-in)**.
5. Follow the trail in the **Explorer**. On Sepolia, every page has **View on Etherscan** links.

Then run `npm run sepolia -- verify:sepolia -w contracts` again to verify the project contracts.

---

## Step 20 — The live run: a fresh scenario

Blockchain history on Sepolia **can't be erased**, so the live run uses **new wallets and new
contracts**. The rehearsal stays on the chain as a separate record:

```bash
npm run sepolia -- provision -- --name "Frosties – live" --exchange1 0xYOUR_EXCHANGE1_ADDRESS --replace
npm run sepolia -- preflight:sepolia -w contracts
npm run sepolia -- deploy:sepolia -w contracts
npm run sepolia -- verify:sepolia -w contracts
npm run sepolia -- register-creators:sepolia -w contracts
npm run sepolia -- fund:sepolia -w contracts
npm run sepolia -- indexer
```

This needs another 0.53 ETH or so on Exchange 1 and about 0.12 ETH on the Deployer. Print the
**new** login cards and import the **new** keys (step 18).

After the event:
- delete the `organizer-secrets/scenario-*` files;
- remove the imported accounts from the participants' MetaMask;
- keep `deployments/11155111.json`.

---

## If something goes wrong

| Symptom | Likely cause and fix |
|---|---|
| `web/.env.sepolia not found` | Step 7 not done. The file must be exactly `web/.env.sepolia`. |
| `self-signed certificate in certificate chain` | `DATABASE_SSL_CA` is missing or broken. Redo step 7 point 1. |
| `password authentication failed` / `Tenant or user not found` | Wrong password or connection string. Copy the Transaction pooler URI again (step 6). |
| `Refusing to run on chain …` | The command didn't load the Sepolia settings. Always start it with `npm run sepolia -- …`. |
| `Signer … is not this scenario's Exchange 1` | The Exchange 1 key in the keystore isn't the address you gave `--exchange1`. |
| `Exchange 1 holds … ETH but needs …` | More faucet ETH needed on Exchange 1. |
| `On Sepolia set NFT_BASE_URI…` | Put the Vercel address in `NFT_BASE_URI` (step 7). |
| Verification says the bytecode doesn't match | Deploy and verify must both use the npm scripts above; they use the same production settings. |
| Vercel build fails | Send Claude the red lines from the build log. |
| The website shows "Not available yet: contracts are not deployed" | Steps 14–16 not done yet, or done for a different scenario. |
| The Supabase project is paused | Open the Supabase dashboard → **Restore project**. |
