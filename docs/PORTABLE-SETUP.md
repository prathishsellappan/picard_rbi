# Running the role-play on another laptop (offline)

This puts the whole role-play on a laptop you can take anywhere: the website, the local test
blockchain and the database, all on that one machine. During the demo **no internet is needed**.

**Do the setup once, with internet**, at least a few hours before the demo. The first run
downloads things it then keeps: Node packages, the Solidity compiler and the website's fonts.
After that it runs offline.

Test assets only, as on this Mac. Nothing touches real money.

---

## Step 0 — On THIS Mac: get the code ready (2 minutes)

The code goes to the other laptop through your **private** GitHub repo
`prathishsellappan/picard_rbi`. The guides reveal the storyline, so keep it private:
GitHub → repo → **Settings** → bottom of the page → **Change visibility** → Private.

1. Make sure every change is committed (ask Claude, or run `git status` in the project folder).
2. Upload:
   ```bash
   cd /Users/prathish/Desktop/picard
   git push origin main
   ```

> **No internet at all on the other laptop?** Copy the project folder by USB drive instead, but
> **without** the `node_modules`, `.next` and `contracts/artifacts` folders. The other laptop
> still needs internet once for step 2 (`npm install`).

---

## Step 1 — Install the tools on the other laptop

### Windows 10/11

1. **Node.js 22 LTS**: from https://nodejs.org, download the **LTS** "Windows Installer
   (.msi)". Run it and keep the defaults. Tick "Automatically install the necessary tools" if
   you're asked.
2. **Git**: from https://git-scm.com/download/win. Keep the defaults.
3. **PostgreSQL 17**: from https://www.postgresql.org/download/windows/ (the EDB installer).
   - Keep the defaults and **write down the password** you set for the `postgres` user.
   - You can untick "Stack Builder" at the end.
4. **Firefox or Chrome** with the **MetaMask** extension (https://metamask.io).

Then open **PowerShell** (Start menu → type "PowerShell") and create the database:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres picard
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres picard_test
```

Each command asks for the postgres password you wrote down.

### macOS

1. **Homebrew**: if you don't have it, follow the one-line install on https://brew.sh.
2. In **Terminal**:
   ```bash
   brew install node@22 git postgresql@17
   brew link --force node@22
   brew services start postgresql@17
   export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
   createdb picard
   createdb picard_test
   ```
3. **Firefox or Chrome** with the **MetaMask** extension.

Check the versions: `node --version` should show `v22.x` (v26 also works), and `npm --version` 10 or higher.

---

## Step 2 — Get the project and install it

Windows (PowerShell) or macOS (Terminal):

```bash
cd ~/Desktop
git clone https://github.com/prathishsellappan/picard_rbi.git picard
cd picard
npm install
```

The repo is private, so GitHub asks you to sign in:
- **Windows:** a browser window opens; approve it.
- **macOS:** use your GitHub username and a **personal access token** as the password
  (GitHub → Settings → Developer settings → Personal access tokens → Generate, with "repo" access).
- Alternatively, use **GitHub Desktop** (https://desktop.github.com) → **Clone repository**.

`npm install` takes a few minutes.

---

## Step 3 — Point the app at the database

Create the settings file from the template.

Windows:
```powershell
copy web\.env.example web\.env.local
notepad web\.env.local
```

macOS:
```bash
cp web/.env.example web/.env.local
open -e web/.env.local
```

In that file, keep `NEXT_PUBLIC_CHAIN_ID=31337` and `RPC_URL=http://127.0.0.1:8545`. Set
`DATABASE_URL`:
- **Windows** (the postgres user has a password):
  `DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/picard`
- **macOS** (Homebrew, no password): leave it as `DATABASE_URL=postgres://localhost:5432/picard`

Save the file.

---

## Step 4 — Start everything (the first run needs internet)

```bash
npm run local
```

It prints each step:
1. It checks the database and creates the tables.
2. It starts the local test blockchain.
3. It creates the **Frosties scenario**: 15 participants, Exchange 1 and Exchange 2.
4. It deploys the contracts, approves the 5 creators and funds all 15 wallets.
5. It starts the indexer and the website.

When you see the box with **App: http://localhost:3000**, it's ready. **Leave this window open**
for the whole demo, because closing it stops everything. Press **Ctrl+C** to stop.

On Windows, allow access if the firewall asks about Node.js. "Private networks" is enough.

Once this first run has worked, the laptop no longer needs internet. Stopping and starting
`npm run local` again works offline and keeps the same logins.

---

## Step 5 — The login cards are NEW on this laptop

Passwords are stored only as scrambled hashes in each laptop's own database. A fresh laptop
therefore gets **new passwords**, and the cards printed from the old Mac **won't work** here.

The new cards are in **`organizer-secrets/credentials-local.csv`** on the new laptop:

| Login | Who |
|---|---|
| `organizer` | you |
| `frosties` | the Frosties creator (secretly the malicious one) |
| `creator1`–`creator4` | ordinary project creators |
| `buyer1`–`buyer9` | buyers |
| `mule` | the second wallet |

Print them or copy them out. The folder `organizer-secrets/` is never uploaded to GitHub.

---

## Step 6 — MetaMask on that laptop

1. **Add the network.** In MetaMask, open the network menu → **Add a custom network** and enter:
   - Network name: `Local Hardhat`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`

   **Trap:** if MetaMask already has a network called *Localhost 8545* with chain ID **1337**,
   edit it to **31337** or delete it. Otherwise the app keeps saying "wrong network".
2. **Import the wallets you'll use.** Open `organizer-secrets/local-wallet-keys.csv`, take a
   participant's `private_key`, then in MetaMask choose **Add account → Import account** and
   paste it. Rename each account after the login (`frosties`, `buyer1`, `mule`, …). These are
   public test keys that only work on this local chain.
3. **More than one role at once:** use a separate browser profile per participant, each with its
   own MetaMask and only that participant's key.
   - Firefox: open `about:profiles` → Create a New Profile.
   - Chrome: profile icon → Add.
4. **After every restart of `npm run local`**: in each MetaMask account, choose **Settings →
   Advanced → Clear activity tab data**. Otherwise transactions can get stuck.

---

## Step 7 — Check before the demo (5 minutes)

1. In a second terminal window, in the project folder:
   ```bash
   npm run preflight:local -w contracts
   ```
   It should end with **"No blocking problems found."**
2. Open http://localhost:3000, log in as `organizer`, and check that **Overview** shows 15
   participants with **Funded: yes**, and that **Explorer** lists the named wallets.
3. For a **clean start**, press **Ctrl+C** in the `npm run local` window, run `npm run local`
   again, and clear MetaMask's activity data.

The demo flow itself is in [ORGANIZER-GUIDE.md](ORGANIZER-GUIDE.md), section 5.2.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Can't reach Postgres` | Start PostgreSQL. **Windows:** Start → "Services" → *postgresql-x64-17* → Start. **macOS:** `brew services start postgresql@17`. Also check the password in `DATABASE_URL`. |
| `password authentication failed` | The password in `web/.env.local` doesn't match the one set while installing PostgreSQL. |
| `database "picard" does not exist` | Run the `createdb` commands from step 1. |
| `port 3000` or `8545` already in use | Another copy is running. Close the other terminal window, or restart the laptop. |
| `npm install` errors | Check `node --version` shows v22 or newer, delete the `node_modules` folder, then run `npm install` again (with internet). |
| The first `npm run local` fails while "Deploying contracts" | It needs internet once, to download the Solidity compiler. Connect and run it again. |
| The website shows plain fonts offline | The fonts are fetched on the first run with internet; run once online. |
| MetaMask says *wrong network* | Select **Local Hardhat** (chain 31337), and watch for the *Localhost 8545 / 1337* trap. |
| MetaMask says *connected to a different account* | Click **Choose account in MetaMask** and tick only that participant's account. |
| A transaction stays *pending* | Click **Check again**. After a chain restart, clear MetaMask's activity data. |
