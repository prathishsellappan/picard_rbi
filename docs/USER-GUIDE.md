# Participant guide

This website is a classroom role-play. Everything happens on a **test network** with test ETH
that has **no monetary value**. You can't lose real money, and nothing you do here touches a
real exchange or bank.

Read **Part A** first; everyone needs it. Then read the part for your role, which is printed on
your login card. Your organizer may give you only the sections for your role.

- Part A: logging in, your wallet, and transactions (everyone)
- Part B: Creator
- Part C: Investor
- Part D: Your role's dashboard ("Dashboard" in the menu)
- Part E: the Explorer (everyone)
- Part F: troubleshooting

---

## Part A — Everyone

### A1. What you get from the organizer

- **A login card** with your **login** and a **password**. The login tells you your role:
  `creator1`–`creator5`, `investor1`–`investor9`, or `mule`.
- **A prepared computer or browser.** MetaMask is installed, your assigned wallet is already
  imported, and the right network is selected. You don't create a wallet, and you never type a
  seed phrase or private key.

If MetaMask asks you to unlock it, use the MetaMask password your organizer gives you. This is a
different password from your website password.

### A2. Logging in

1. Open the website address from your organizer. On the organizer's own computer that is
   **http://localhost:3000**.
2. The yellow bar at the top shows the network: **Local Hardhat** or **Sepolia**. It always says
   *Assets have no monetary value*.
3. On **Role-play login**, enter:
   - **Login**: as on your card, for example `investor3`. Upper or lower case and spaces don't
     matter, so `Investor 3` works too.
   - **Password**: exactly as on your card. Upper and lower case **do** matter.
4. Click **Log in**. You land on your own dashboard automatically.

If you see **Invalid login or password**, check the password carefully: cards avoid confusable
characters such as `0`/`O` and `1`/`l`. Ask the organizer if it still fails, since they can reset it.

Your login lasts up to 12 hours. **Log out** is at the top right. The top bar shows your name
and login, for example `Investor 3 (investor3)`.

### A3. Connecting your wallet

Every dashboard has a **Your wallet** panel. It shows your **assigned wallet**, the address the
organizer gave you, and whether MetaMask is ready.

| What the panel says | What it means | What to do |
|---|---|---|
| *Checking MetaMask…* | The page is looking for MetaMask. | Wait a second. |
| *MetaMask is not installed in this browser* | No MetaMask in this browser. | Ask the organizer. |
| *Connect MetaMask to continue.* | MetaMask hasn't shared an account with the site yet. | Click **Connect MetaMask** and approve in the MetaMask window. |
| *MetaMask is connected to a different account…* | MetaMask is using another account. The panel shows both addresses and numbered steps. | Click **Choose account in MetaMask**. In the MetaMask window, select **only** the account whose address ends with the four characters shown, then confirm. If that account isn't in MetaMask, ask the organizer. |
| *MetaMask is on the wrong network* | MetaMask is on another network. The panel shows the chain it is on and the one needed. | Click **Switch to …** and approve in MetaMask. If that doesn't work, the panel lists the exact settings (network name, RPC URL, chain ID, symbol) for adding the network by hand in MetaMask. |
| *Assigned wallet connected.* (green) | Everything is ready, and your **Balance** is shown. | You can now use your dashboard. |

All buttons that send transactions stay grey until the panel is green. If you switch accounts
or networks in MetaMask later, the page notices immediately and blocks actions again until
you're back on your assigned wallet.

### A4. Sending a transaction: what you'll see

Every action follows the same pattern:

1. Fill in the form and click **Review…**. The site shows a summary; check it carefully.
2. Click the confirm button, for example **Send with MetaMask**. A **MetaMask window** opens.
   It shows the cost, including a small **gas** fee paid in test ETH.
3. Click **Confirm** in MetaMask (or **Reject** to cancel).

A status box then shows what is happening:

| Status | Meaning |
|---|---|
| **requested** | Waiting for you to approve in MetaMask. |
| **pending** | Sent to the network; waiting to be included in a block. The **Tx** hash is shown. |
| **confirmed** | The network has included it and it succeeded. The website checked this on the blockchain itself. |
| **failed** | It was included but the contract refused it (reverted). The message explains why. |
| **rejected** | You clicked Reject in MetaMask. Nothing was sent, and nothing was spent. |
| **timeout** | No confirmation yet. It may still go through; click **Check again** after a moment. |

If the site says *Not sent — the transaction would fail: …*, MetaMask found a problem before
sending, so nothing was sent and nothing was spent. The message explains the problem, for
example a price outside the allowed range.

A transaction that is **pending** is not finished. Only trust **confirmed**.

### A5. Your instructions

The **Your instructions** panel shows the briefing your organizer wrote for you. Only you can
see your own instructions.

### A6. My transactions

**My transactions** lists the transactions you made through this website, with their latest
status. Each one links to its full details in the Explorer.

---

## Part B — Creator

Your menu shows **My project** and **Explorer**.

### B1. Create your project (once)

1. Make sure the wallet panel is green.
2. In **Create your project**, fill in:
   - **Project name**: up to 64 characters.
   - **Description**: shown to investors in the marketplace (optional, up to 1000 characters).
   - **Mint price in ETH**: what investors pay per NFT. The allowed range appears next to the
     field (for example *0.005–0.02*).
3. Click **Review project**, check the summary, then click **Deploy with MetaMask** and confirm in MetaMask.
4. When it shows **confirmed**, the page switches to **My project**.

You can create **one** project. Its name and price are written to the blockchain and **can't
be changed** afterwards. If you see *Your wallet isn't approved on the project factory yet*,
the organizer hasn't finished setup. Wait and reload.

### B2. My project

This panel shows your project's numbers, read directly from its contract:

| Field | Meaning |
|---|---|
| Mint price | What investors pay per NFT. |
| NFTs minted | How many NFTs investors have minted from your project. |
| Total received | All mint payments your project contract has received. |
| Total withdrawn | How much you have withdrawn so far. |
| Available | Received minus withdrawn: what you can withdraw now. |
| Contract | Your project's contract address (click it on Sepolia to open Etherscan). |

### B3. Withdraw funds

1. Enter an amount, or click **Max** for everything available.
2. Click **Withdraw to my wallet** and confirm in MetaMask.

Withdrawn funds always go to **your own wallet**; the contract allows no other destination. Your
balance in the wallet panel goes up once the transaction is **confirmed**.

### B4. Send test ETH

1. Paste the **recipient address** (it starts with `0x` and is 42 characters long). Paste it
   rather than typing it. A mistyped mixed-case address is rejected by the checksum check.
2. Enter the **amount**, or click **Max**. Max keeps a small amount back for gas.
3. Click **Review transfer**. **Check the full address on the review screen**, then click
   **Send with MetaMask** and confirm.

Blockchain transfers can't be undone, so always check the address before confirming.

---

## Part C — Investor

Your menu shows **Marketplace** and **Explorer**.

### C1. Browse projects

Each project card shows its **name**, **description**, **mint price**, how many NFTs were
**minted**, and its **contract** address. The marketplace lists every project registered on the
blockchain.

### C2. Mint an NFT

1. Make sure the wallet panel is green and your balance covers the mint price plus a little gas.
2. On the project's card click **Mint NFT**. A question appears:
   *Mint 1 … NFT for … test ETH (plus gas)?*
3. Click **Confirm in MetaMask**, then confirm in MetaMask.
4. When it shows **confirmed**, the NFT appears under **My NFTs** and the project's **NFTs
   minted** goes up.

Your payment goes through the marketplace contract straight to that project's contract. Each
click mints one NFT. Follow your instructions for which projects to choose and how many to mint.

### C3. My NFTs

This lists the NFTs your wallet owns, as recorded by the NFT contract: token number and project.

---

## Part D — Dashboard (transfer role)

Your menu shows **Dashboard** and **Explorer**.

### D1. Incoming transfers

This lists test ETH that arrived in your wallet: amount, sender, block and transaction link.
New transfers show up within a few seconds, once the organizer's indexer has picked them up.
Your current balance is always in the wallet panel.

### D2. Transfer to Exchange 2

The recipient is fixed: **Exchange 2**. Its address is shown and you can't change it.

1. Enter the amount, or click **Max** to send everything except a small gas reserve.
2. Click **Review transfer**, check the amount, click **Send with MetaMask** and confirm.
3. Wait for **confirmed**. The transaction hash is shown and also appears in **My transactions**.

---

## Part E — The Explorer (everyone)

Click **Explorer** in the menu. It shows the role-play's public blockchain activity, the same
data anyone could read from the blockchain.

### E1. Search

Paste a full **wallet or contract address** (`0x` + 40 characters) or a **transaction hash**
(`0x` + 64 characters) and click **Search**.

### E2. Explorer home

- **Scenario addresses**: every wallet and contract in the role-play. Wallets are labelled
  neutrally as `P01`…`P15` (not by login name), plus **Exchange 1** and **Exchange 2**. Contracts are labelled by name,
  and projects show as `Project: <name>`. Click any label to open its page.
- **Latest scenario transactions**: block, time, transaction, method, from, to, value, status.
- A line shows how far the index has caught up, for example *Indexed up to block 120*.

### E3. Address page

| Section | What it shows |
|---|---|
| Overview | The full address and its **current balance**, read live. On Sepolia, a link to Etherscan. |
| Incoming / Outgoing transactions | Transactions sent to and from this address. |
| Internal ETH movements | ETH moved by contracts *inside* other transactions: a mint payment forwarded from the Marketplace to a project, or a project withdrawal to its creator. These don't appear as separate transactions, so they are rebuilt from the contracts' events. |
| NFT transfers | NFTs minted to or transferred from this address. |
| Events emitted by this contract | For contract pages: every event the contract recorded. |

### E4. Transaction page

This page is read **live from the blockchain**. It shows:
- status, block, timestamp, from, to, value, method and gas used;
- internal ETH movements;
- every event from the role-play contracts, with its details.

Addresses inside are clickable. On Sepolia, **View on Etherscan** opens the public explorer.

---

## Part F — Troubleshooting

| Problem | Try this |
|---|---|
| Buttons are grey | The wallet panel isn't green. Follow its message (section A3). |
| *MetaMask is connected to a different account* | Click **Choose account in MetaMask** and select your assigned account (section A3). |
| MetaMask didn't open | Click the MetaMask fox icon in the browser toolbar. The request may be waiting there. |
| Stuck on **pending** | Wait, then click **Check again**. Don't send the same thing twice. |
| *Not enough test ETH* | Your balance doesn't cover the amount plus gas. Tell the organizer. |
| *Not available yet: contracts are not deployed* | The organizer is still setting up. Reload in a minute. |
| You were logged out | Log in again with your card. |
| Something else | Note the message and the transaction hash (if any) and ask the organizer. |
