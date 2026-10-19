# Running the role-play with Docker (any machine, including AWS)

Docker packs the whole role-play into containers, so the machine only needs **Docker**: no Node,
no Postgres, no Homebrew. Two containers run:

| Container | What runs in it |
|---|---|
| `app` | the website (production build), the local test blockchain (Hardhat, chain 31337) and the indexer, all started by the same starter as `npm run local` |
| `db` | PostgreSQL 17, with a saved volume, so logins and settings survive restarts |

Everything works as it does on this Mac: the same Frosties scenario, logins, explorer and
MetaMask flow. Test ETH only.

---

## 1. Install Docker

- **macOS / Windows:** install **Docker Desktop** from https://www.docker.com/products/docker-desktop
  and start it.
- **Linux, including an AWS EC2 instance** (Ubuntu shown):
  ```bash
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2 git
  sudo usermod -aG docker $USER   # then log out and back in
  ```

Check: `docker --version` and `docker compose version`.

---

## 2. Get the project

The repo is private, so sign in to GitHub when asked:

```bash
git clone https://github.com/prathishsellappan/picard_rbi.git picard
cd picard
```

---

## 3. Settings

```bash
cp docker.env.example .env
```

Edit `.env`:
- **`PUBLIC_HOST`**: the address participants' devices use to reach this machine.
  - Same Wi-Fi: the machine's network IP (macOS: `ipconfig getifaddr en1` or `en0`; Linux:
    `hostname -I`).
  - AWS: the instance's **public IPv4 address** or public DNS name (EC2 console → instance details).
- **`POSTGRES_PASSWORD`**: any password. It's only used between the two containers.
- **`COOKIE_SECURE=false`**: keep this while you use plain `http://` (see section 7).

`.env` is gitignored. Never commit it.

---

## 4. Start

```bash
docker compose up --build
```

The **first** run builds the image (5–10 minutes, needs internet). It then prints the same ready
box as `npm run local`, including the addresses to share:

```
 Other devices:
   App:          http://<PUBLIC_HOST>:3000
   MetaMask RPC: http://<PUBLIC_HOST>:8545   (chain ID 31337)
```

To run it in the background, use `docker compose up --build -d`, then `docker compose logs -f app`
to watch.

- **Stop:** `docker compose down`. Logins and settings are kept in the database volume.
- **Wipe everything,** including logins: `docker compose down -v`.

---

## 5. Login cards and wallet keys

The container writes them to **`docker-data/organizer-secrets/`** on the host:
- `credentials-local.csv`: the login cards (`organizer`, `frosties`, `creator1`–`creator4`,
  `buyer1`–`buyer9`, `mule`);
- `local-wallet-keys.csv`: each participant's key to import into MetaMask.

They're **new** for each new database. The cards from the Mac's own `npm run local` don't work
here. On AWS, download them with `scp`. Keep the folder private; it's gitignored.

---

## 6. Participants' devices

1. **Firefox or Chrome** with MetaMask. Safari has no MetaMask.
2. Open **`http://<PUBLIC_HOST>:3000`** and log in with the card.
3. Click **Connect MetaMask**, then **Switch to Local Hardhat**. The app hands MetaMask the right
   address (`http://<PUBLIC_HOST>:8545`, chain 31337) automatically. To add it by hand: RPC URL
   `http://<PUBLIC_HOST>:8545`, chain ID `31337`, symbol `ETH`.
4. Import that participant's key from `local-wallet-keys.csv`. Send it privately, not by group chat.

---

## 7. On AWS: what to set up

1. **Instance:** Ubuntu 24.04, **t3.small** (2 GB RAM) or larger. A t3.micro (1 GB) is too small
   for building and running the website and the chain together. Storage: 20 GB.
2. **Security group (inbound rules):**

   | Port | From | Why |
   |---|---|---|
   | 22 | **My IP** only | SSH for you |
   | 3000 | participants' network, or anywhere for a public demo | the website |
   | 8545 | the same as 3000 | the test blockchain for MetaMask |

   Don't open Postgres (5432); it isn't published anyway.
3. **Keep the instance running** during the session. Stopping and starting an EC2 instance usually
   gives it a **new public IP**. Then update `PUBLIC_HOST` in `.env`, run `docker compose up -d`
   again, and tell participants the new address. An **Elastic IP** keeps it fixed.
4. **Plain http and HTTPS.** With `COOKIE_SECURE=false` everything works over `http://`. For a
   public demo it's better to put an HTTPS reverse proxy in front, such as Caddy or nginx with a
   free Let's Encrypt certificate, on a domain name, for both the website and the chain, and then
   set `COOKIE_SECURE=true`. Not required for a classroom demo.
5. **Anyone who can reach ports 3000/8545 can use the test chain.** It holds no real value, but
   limit the security group to the participants' network if you can.

---

## 8. Restarts and resets

- **Restarting the containers erases the test blockchain** (projects, mints, transfers), as with
  `npm run local`. On start, the app detects this, redeploys the contracts and refunds the wallets.
  **Logins stay the same.** Participants then clear MetaMask's history: **Settings → Advanced →
  Clear activity tab data**.
- **New passwords:** `docker compose down -v`, then `docker compose up -d`, and reprint the cards
  from `docker-data/organizer-secrets/`.
- **After pulling new code:** `git pull`, then `docker compose up --build -d`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Participants can't open the page | Check the security group (AWS) or that they're on the same network, and that they use `PUBLIC_HOST`, not `localhost`. |
| Login doesn't stick (you're sent back to the login page) | `COOKIE_SECURE` must be `false` for plain http. |
| MetaMask "wrong network" / can't reach the RPC | Port 8545 must be open, and the RPC URL must be `http://<PUBLIC_HOST>:8545` with chain ID 31337. |
| The build is killed or very slow on AWS | The instance is too small. Use t3.small or larger. |
| `port is already allocated` | Something else uses 3000 or 8545 on the host, for example `npm run local`. Stop it first. |
| The ready box shows strange 172.x addresses | `PUBLIC_HOST` isn't set in `.env`. |
