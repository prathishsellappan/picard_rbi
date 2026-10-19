# Sepolia deployment and rehearsal runbook

> New to this? Follow the detailed beginner version, [DEPLOY-STEP-BY-STEP.md](DEPLOY-STEP-BY-STEP.md).
> This page is the compact reference.

Sepolia test ETH only. Nothing here touches Mainnet: the app, scripts and Hardhat config accept
only chain IDs 31337 and 11155111, and every script checks the connected chain before signing.

Steps marked **(you)** need accounts or secrets that only the organizer can provide. Everything
else is a command run from the repository root on the organizer's machine.

## 1. What you need

| Item | Used for | Notes |
|---|---|---|
| Sepolia RPC URL (Alchemy or Infura) **(you)** | scripts, indexer, hosted app | The free tier is enough. Keep the key out of git. |
| Etherscan API key **(you)** | contract source verification | One key works for Sepolia. |
| Hosted Postgres, e.g. Supabase **(you)** | hosted app and indexer share it | Use the pooler connection string with `?sslmode=require`. |
| Web hosting, e.g. Vercel **(you)** | participants open the app | Root directory `web/`. |
| Deployer wallet **(you)** | deploys contracts, allows creators | Separate from Exchange 1, so Exchange 1's history holds only scenario funding. |
| Exchange 1 wallet **(you)** | initial funding of all 15 wallets | Funded from faucets. |
| Prepared devices **(you)** | one per participant | MetaMask installed, Sepolia selected. |

## 2. Sepolia ETH budget

Gas use was measured in the Stage 7 end-to-end run (see `contracts/scripts/lib/gas.ts`):

| Action | Gas |
|---|---|
| Deploy all contracts and wire them | ~5,700,000 |
| Allow one creator | ~50,000 |
| Create a project | ~860,000 |
| Mint | ~170,000 |
| Withdraw | ~60,000 |
| ETH transfer | 21,000 |

Frosties prices on Sepolia are 10× below the real case: the mint is 0.004 ETH, and the price
bounds are 0.001–0.005 ETH. The default Sepolia funding plan is: creator 0.05, buyer 0.02 + 0.01,
second wallet 0.01.

| Wallet | Needs | At 5 gwei | At 20 gwei |
|---|---|---|---|
| Deployer | ~5.95M gas | 0.03 ETH | 0.12 ETH |
| Exchange 1 | 0.53 ETH funding + 15 transfers | 0.53 ETH | 0.54 ETH |
| **Total to collect** | | **~0.57 ETH** | **~0.66 ETH** |

Faucets typically give 0.05–0.5 ETH per day, so start collecting early. To need less, lower the
amounts on the organizer **Scenario** page *before deploying*. The factory copies the mint price
bounds at deploy time. For example:

- mint prices 0.001–0.003 ETH;
- investors 0.01 gas + 0.006 scenario funds;
- creators 0.02 gas;
- mule 0.002 gas.

That totals about 0.25 ETH for funding plus the deployer's gas. Run `preflight:sepolia` after
any change: it compares each role's gas funding with the measured gas at 3× the current fee.

## 3. One-time setup

### 3.1 Organizer environment

The Sepolia settings live in their own file, `web/.env.sepolia`, which is gitignored. Your local
demo keeps using `web/.env.local` unchanged. Create it from the template:

```bash
cp web/.env.sepolia.example web/.env.sepolia
```

Fill it in:
- **`RPC_URL`**: your Alchemy Sepolia HTTPS URL.
- **`DATABASE_URL`**: in Supabase, open **Project Settings → Database → Connection string**, choose
  **Transaction pooler** (port 6543), and fill in your database password.
- **`DATABASE_SSL_CA`**: in Supabase, open **Project Settings → Database → SSL Configuration →
  Download certificate**, then paste the certificate text. Supabase signs its certificates with
  its own CA, so this is what lets the connection be both encrypted and verified.
- **`NFT_BASE_URI`**: your hosted app's URL followed by `/api/nft/`.

Every organizer command for Sepolia then goes through the wrapper, which loads that file:

```bash
npm run sepolia -- db:migrate              # create the tables in the hosted database
```

### 3.2 Organizer secrets in the Hardhat keystore **(you)**

The keystore is encrypted and lives outside the repository. Each command asks for the value and
the keystore password. Run them yourself in `contracts/`, and don't paste these values anywhere else.

```bash
cd contracts
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_DEPLOYER_PRIVATE_KEY
npx hardhat keystore set SEPOLIA_EXCHANGE1_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
```

`npx hardhat keystore list` shows which keys are stored. It never shows the values.

### 3.3 Hosted web app **(you)**

On Vercel (or another Node host):
1. Push the code to your **private** GitHub repo (`git push origin main`).
2. In Vercel, choose **Add New → Project** and import that repo.
3. Set **Root Directory** to `web` and keep "Include files outside the root directory" on, since the
   app is an npm workspace.
4. Add these environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` |
| `RPC_URL` | your Sepolia RPC URL (server-side only) |
| `DATABASE_URL` | the hosted Postgres pooler URL (same as in `web/.env.sepolia`) |
| `DATABASE_SSL_CA` | the Supabase CA certificate text (same as in `web/.env.sepolia`) |
| `SESSION_TTL_HOURS` | e.g. `12` |

Note the app's URL, for example `https://picard-roleplay.vercel.app`. The NFT metadata route
will be `<url>/api/nft/`.

## 4. Each scenario (rehearsal or live run)

Every rehearsal and the live run is a **new scenario** with fresh wallets and a fresh deployment.
Sepolia history can't be erased, and a new scenario keeps runs from mixing.

1. **Provision wallets and logins.** Use your funded Exchange 1 address:
   ```bash
   npm run sepolia -- provision -- --name "Frosties – Sepolia rehearsal 1" --exchange1 0xYourExchange1
   ```
   Add `--replace` from the second scenario on. The previous scenario is deactivated, not deleted.
   Keys and login cards are written to `organizer-secrets/scenario-<id>-chain-11155111-*`.
   Logins and explorer labels follow the Frosties case (`frosties`, `creator1`–`creator4`,
   `buyer1`–`buyer9`, `mule`). P01 runs Frosties by default.
2. **Configure (you).** Log in to the hosted app as `organizer`.
   - Write each participant's instructions on **Participants**.
   - Check the mint bounds and funding on **Scenario**. Both must be final before step 4.
3. **Preflight:**
   ```bash
   npm run sepolia -- preflight:sepolia -w contracts
   ```
   Fix every `FAIL`, and read every `WARN`.
4. **Deploy** with the production build profile. The script writes `deployments/11155111.json`;
   commit it, since it's public information the investigation app will use.
   ```bash
   npm run sepolia -- deploy:sepolia -w contracts      # NFT_BASE_URI comes from web/.env.sepolia
   ```
5. **Verify the source on Etherscan:**
   ```bash
   npm run sepolia -- verify:sepolia -w contracts
   ```
   Run it again after the creators have created their projects, so the projects get verified too.
6. **Allow the creators, then fund all 15 wallets from Exchange 1:**
   ```bash
   npm run sepolia -- register-creators:sepolia -w contracts
   npm run sepolia -- fund:sepolia -w contracts
   npm run sepolia -- preflight:sepolia -w contracts
   ```
   Both are safe to re-run. Already-allowed creators and already-funded wallets are skipped.
7. **Start the indexer** on the organizer machine and leave it running for the whole session:
   ```bash
   npm run sepolia -- indexer
   ```
8. **Prepare the devices (you).** On each device:
   - In MetaMask choose **Add account → Import account** and paste that participant's private key
     from the wallets file. Name the account after the participant ID.
   - Select the Sepolia network.
   - Hand over the login card.
   Keep the wallets file off shared machines.

## 5. Rehearsal checklist

The organizer can rehearse alone, using one browser profile per participant. Tick each item
against what the app shows **and** what Etherscan shows.

- [ ] Every role can log in. A wrong password is rejected.
- [ ] Connecting a different MetaMask account shows "not your assigned wallet", and actions stay disabled.
- [ ] Switching MetaMask to another network blocks actions and offers **Switch to Sepolia**.
- [ ] Each creator creates a project. It appears in the marketplace with its description.
- [ ] Investors mint. NFTs appear under **My NFTs**, and project totals go up.
- [ ] A rejected MetaMask prompt shows "rejected". A slow transaction shows pending, then confirmed
      after **Check again**.
- [ ] An honest creator withdraws part of their project's funds.
- [ ] The malicious creator withdraws, then uses **Send test ETH** to the mule's address.
- [ ] The mule sees the incoming transfer and sends it with **Transfer to Exchange 2**.
- [ ] The explorer shows the trail: project page (internal movements) → creator → mule → Exchange 2.
      Every **View on Etherscan** link opens the matching Sepolia page.
- [ ] The organizer progress table matches. Participant views show no roles and no malicious flag.
- [ ] `npm run sepolia -- verify:sepolia -w contracts` reports every contract verified.
- [ ] Rerun `npm run sepolia -- preflight:sepolia -w contracts`, and check the remaining balances are enough for the live run.

## 6. Live run and afterwards

- Use a fresh scenario (step 4.1 with `--replace`), not the rehearsal's wallets.
- Keep the indexer running until the last transfer to Exchange 2 is indexed.
- Afterwards, keep the following for the investigation app. It needs nothing else from this app.
  - `deployments/11155111.json` (committed);
  - the 17 public addresses (the explorer's address list);
  - the verified contracts.
- Delete the `organizer-secrets/scenario-*` files once they're no longer needed. The wallets and
  their history remain on Sepolia.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Verification says the bytecode doesn't match | Deploy and verify must both use `--build-profile production`. The npm scripts already do. |
| `Refusing to run on chain …` | `NEXT_PUBLIC_CHAIN_ID` and the network don't match. Check `web/.env.local`. |
| `Signer … is not this scenario's Exchange 1` | The keystore's Exchange 1 key isn't the address given to `provision --exchange1`. |
| A transaction stays pending | Sepolia is congested. Wait and press **Check again**; MetaMask can speed it up. |
| The indexer hits RPC rate limits | It retries on the next poll. Lower `maxBlocks` in `scripts/indexer.ts` if needed. |
| Explorer lists lag behind | The indexer isn't running, or it is 3 blocks behind the head by design. Use **Sync index now**. |
| Contracts use the `osaka` EVM target | Sepolia has supported it since the Fusaka upgrade (October 2025). |
