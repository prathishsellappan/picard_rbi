# Contracts

Source: `contracts/contracts/`. Solidity 0.8.34, OpenZeppelin 5.6. Test assets only.
ABIs for the web app are exported to `web/lib/abi/` (`npm run export-abis -w contracts`).
Deployed addresses, deploy tx hashes and the start block are written to `deployments/<chainId>.json`.

## Overview

| Contract | Deployed by | Purpose |
|---|---|---|
| `ScenarioNFT` | organizer deployer | One shared ERC-721 for all projects. Only the marketplace mints. |
| `ProjectFactory` | organizer deployer | Allowlist of creators, deploys one `Project` per creator, registry for the marketplace. |
| `Project` | `ProjectFactory` (in the creator's `createProject` tx) | Holds one project's mint payments; creator withdrawals. |
| `Marketplace` | organizer deployer | Mints NFTs and routes the full payment to the chosen project. |

Wiring is one-time: `ProjectFactory.setMarketplace` and `ScenarioNFT.setMarketplace` can each be
called once by the owner and can't be changed afterwards.

## Permissions

| Action | Who may call | Enforced by |
|---|---|---|
| `ProjectFactory.setCreatorAllowed` | factory owner (organizer) | `onlyOwner` |
| `ProjectFactory.setMintPriceBounds` | factory owner | `onlyOwner` (applies to projects created afterwards) |
| `ProjectFactory.createProject` | allowed creator, once | allowlist + `projectOfCreator` |
| `Marketplace.mint` | anyone (investors) | must target a factory project and pay exactly its mint price |
| `Project.deposit` | marketplace only | `NotMarketplace` |
| `Project.withdraw` | that project's creator only | `NotCreator` |
| `ScenarioNFT.mint` | marketplace only | `NotMarketplace` |
| `ScenarioNFT.setBaseURI` | NFT owner (organizer) | `onlyOwner` |

## Withdrawal rule

- Only the project's creator can call `withdraw(amount)`, at any time.
- `amount` must be greater than 0 and no more than `availableToWithdraw() = totalReceived - totalWithdrawn`.
- The funds always go to the creator's own address. There is no "withdraw to another address".
- Accounting uses `totalReceived`, not the contract balance, so ETH forced into a project by other
  means can't be withdrawn and doesn't distort the totals.
- `nonReentrant` plus checks-effects-interactions. If the transfer to the creator fails, the whole
  withdrawal reverts (`TransferFailed`) and the accounting is unchanged.

In the role-play, the malicious creator withdraws to their own wallet. They then send the ETH to
the mule with an ordinary transfer from the creator dashboard. Honest creators can withdraw under
exactly the same rule.

## Payments

- `Marketplace.mint(project)` requires `factory.isProject(project)` and `msg.value == project.mintPrice()`.
  It mints the next token to the caller, then calls `project.deposit{value: msg.value}(investor, tokenId)`.
- The marketplace keeps nothing and charges no fee. `Marketplace` and `Project` have no `receive`/`fallback`, so
  direct ETH transfers to them revert.
- A look-alike `Project` deployed outside the factory is rejected (`UnknownProject`).

## Events

| Contract | Event | Meaning |
|---|---|---|
| `ProjectFactory` | `ProjectCreated(projectId, project, creator, name, mintPrice, metadataURI)` | creator → project link |
| `ProjectFactory` | `CreatorAllowed(creator, allowed)` | allowlist changes |
| `ProjectFactory` | `MintPriceBoundsSet(min, max)` | bound changes |
| `ProjectFactory`, `ScenarioNFT` | `MarketplaceSet(marketplace)` | one-time wiring |
| `Marketplace` | `PaymentRouted(project, investor, tokenId, amount)` | investor → project payment |
| `Project` | `FundsReceived(investor, tokenId, amount, totalReceived)` | ETH arriving in a project (internal transfer) |
| `Project` | `Withdrawn(to, amount, totalWithdrawn)` | ETH leaving a project to its creator (internal transfer) |
| `ScenarioNFT` | `Transfer(from, to, tokenId)` (ERC-721) | mints (`from = 0x0`) and transfers |
| `ScenarioNFT` | `BaseURISet(baseURI)` | metadata pointer changes |

The marketplace → project and project → creator ETH movements happen inside other transactions, so
ordinary transaction lists don't show them. `FundsReceived`, `PaymentRouted` and `Withdrawn` are the
public evidence for those hops. The test `test/ScenarioFlow.ts` rebuilds the whole money trail from
these events.

## Organizer scripts

All of these refuse to run unless the connected chain is 31337 or 11155111 and matches
`NEXT_PUBLIC_CHAIN_ID` in `web/.env.local`. They read the active scenario from the database.

| Script | What it does |
|---|---|
| `scripts/deploy.ts` | Deploys NFT, factory and marketplace with the scenario's mint price bounds, wires them, writes `deployments/<chainId>.json`, and stores the addresses in the scenario. Refuses to redeploy unless `REDEPLOY=1`. |
| `scripts/register-creators.ts` | `setCreatorAllowed` for every creator in the scenario. Skips creators already allowed. |
| `scripts/fund-wallets.ts` | Exchange 1 sends each participant gas + scenario funds in one transfer, recording each in `funding_transfers` (requested → pending → confirmed/failed). Checks the signer is the scenario's Exchange 1 and has enough balance. Skips wallets already funded. |
| `scripts/export-abis.ts` | Copies ABIs into `web/lib/abi/`. |
| `scripts/preflight.ts` | Read-only readiness check: chain/config agreement, scenario shape, organizer balances against the measured gas budget, per-role gas funding, deployed code and wiring. |
| `scripts/verify-sepolia.ts` | Verifies NFT, factory, marketplace and every factory-created project on Etherscan (production build profile). |

Signers: locally, Hardhat account 0 is Exchange 1 and account 17 deploys. On Sepolia, signer 0 is
the deployer and signer 1 is Exchange 1, both read from the Hardhat keystore (`SEPOLIA_DEPLOYER_PRIVATE_KEY`,
`SEPOLIA_EXCHANGE1_PRIVATE_KEY`). Contract deployment uses a separate deployer key, so
Exchange 1's on-chain history contains only scenario funding.

The mint price bounds are copied from the scenario into the factory **at deploy time**. Changing them
in the organizer UI afterwards does not change the deployed factory.
