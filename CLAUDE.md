# CLAUDE.md

## Project Overview

This project is an educational Ethereum-based crypto fraud role-play platform.

The application simulates a controlled fraud scenario using test assets on Ethereum Sepolia. Fifteen participants have assigned roles and wallets. Two additional organizer-controlled wallets represent Exchange 1 and Exchange 2.

The purpose is educational: participants perform predefined blockchain activities, while a future independent investigation application will reconstruct the flow of funds from public on-chain evidence.

Do not use real funds, production networks, real exchanges, or real financial services.

---

## Core Scenario

There are 17 Ethereum wallets:

- 5 creators
- 9 investors
- 1 mule
- 1 Exchange 1 address
- 1 Exchange 2 address

Only the 15 participants need application interfaces.

One creator is malicious and works with the mule. The malicious storyline must not be revealed through participant-facing dashboards.

### Payment flow

The expected flow is:

Exchange 1
→ participant/creator wallets
→ project contracts
→ NFT marketplace
→ project funds
→ malicious creator withdrawal
→ mule
→ Exchange 2

The implementation must make the relevant transactions visible on-chain so a future investigation application can reconstruct the flow.

Do not create an intentionally vulnerable smart contract. The suspicious behavior should come from legitimate contract interactions and the scenario configuration.

---

## Technology Stack

Use the following stack unless a clear technical reason requires a change:

- Next.js
- React
- TypeScript
- Tailwind CSS or an equally maintainable component system
- MetaMask
- ethers.js v6
- Solidity
- Hardhat or Foundry, choosing one primary contract framework
- OpenZeppelin contracts
- ERC-721
- PostgreSQL, optionally through Supabase
- Next.js server routes or a small Node.js backend
- Configurable RPC provider such as Alchemy or Infura
- Ethereum Sepolia for the public role-play
- A local Ethereum development network for development and rehearsals

### Important

Use ethers.js for wallet and contract interaction.

Do not add viem unless explicitly requested.

Avoid unnecessary dependencies and abstractions.

Prefer simple, readable code.

---

## Network

The application must operate only on:

1. A configured local development Ethereum network, or
2. Ethereum Sepolia.

The network must be configurable through environment variables.

Validate the active chain before allowing blockchain transactions.

Never allow accidental transactions on Ethereum Mainnet or another production network.

The public role-play uses Sepolia test ETH.

---

## Wallet Management

Each participant has an assigned public Ethereum address.

Example:

```text
Participant ID → Role → Assigned Wallet
P01 → Creator → 0x...
P02 → Creator → 0x...
...
P15 → Mule → 0x...
```

Participant wallet addresses are public information and may be stored in the application database.

Never store:

- Seed phrases
- Private keys for participant wallets
- Private keys in frontend code
- Private keys in source control

Organizer-controlled signing credentials must remain outside the browser and outside version control.

---

## Simple Wallet Connection

This is an educational role-play, so do not introduce unnecessary authentication complexity.

The intended wallet flow is:

1. Participant logs into the application.
2. The server identifies the participant and their assigned wallet.
3. Participant clicks Connect Wallet.
4. MetaMask connects.
5. ethers.js obtains the connected address.
6. Compare the connected address with the participant's assigned address.
7. If they match, allow the participant to continue.
8. If they do not match, reject the connection and ask the participant to use the assigned wallet.

Example:

```typescript
const provider = new ethers.BrowserProvider(window.ethereum);
await provider.send("eth_requestAccounts", []);

const signer = await provider.getSigner();
const address = await signer.getAddress();

if (address.toLowerCase() !== assignedWallet.toLowerCase()) {
  throw new Error("Please connect your assigned wallet");
}
```

Do not implement SIWE, nonce-based wallet authentication, or other complex cryptographic authentication unless explicitly requested later.

However, role authorization must still be enforced server-side. Never rely only on frontend UI restrictions.

If the participant switches MetaMask accounts while using the application, detect the account change and require the correct assigned wallet again.

---

## Authentication and Authorization

Participant login and wallet connection are separate concepts.

Application authentication determines:

- Who the participant is
- What role they have
- Which wallet is assigned to them

Wallet connection determines:

- Which Ethereum address is currently connected to MetaMask

The server must associate:

```text
participant → role → assigned wallet
```

Participants must not be able to modify these values through client-side state.

Do not expose hidden scenario information through API responses sent to participant clients.

---

## Roles

### Creator

Creators can:

- Log in
- Connect their assigned MetaMask wallet
- Access their creator dashboard
- Create a project
- Deploy or interact with the standardized project contract
- View their project
- View relevant transaction history

All five creators should use comparable project contracts.

One creator is malicious, but this must not be disclosed by the participant UI.

### Investor

Investors can:

- Log in
- Connect their assigned MetaMask wallet
- Browse projects
- Select a project
- Mint an NFT
- Pay with test ETH
- View NFT ownership
- View transaction status and history

The marketplace must explicitly route mint payments to the appropriate project contract.

Do not assume that NFT minting itself automatically represents an investment.

### Mule

The mule can:

- Log in
- Connect the assigned wallet
- View assigned instructions
- Inspect relevant incoming transfers
- Transfer received test ETH to Exchange 2
- View transaction hash and status

### Exchange 1

Exchange 1 is organizer-controlled.

It does not need a participant UI.

It is used to distribute initial test ETH.

### Exchange 2

Exchange 2 is organizer-controlled.

It does not need a participant UI.

It is the final destination of the mule's transfer.

---

## Smart Contract Design

Use standard, understandable Solidity contracts.

Prefer OpenZeppelin implementations for standard functionality.

The initial system should contain:

1. Project contract
2. ERC-721 NFT contract
3. Marketplace/payment-routing component
4. Factory only if it materially simplifies the architecture

The project contract must:

- Store relevant project information
- Receive project-related funds
- Account for received funds
- Provide a clearly defined withdrawal mechanism
- Enforce withdrawal permissions
- Emit meaningful events

The marketplace must:

- Identify the selected project
- Mint the relevant NFT
- Receive the mint payment
- Route the payment to the correct project contract
- Emit meaningful events

Do not create reentrancy vulnerabilities or deliberately exploitable contracts.

The fraud scenario should be demonstrated through legitimate contract calls and participant behavior.

---

## Events

Emit useful events for important actions.

At minimum, consider events for:

- Project creation
- Project deployment/registration
- NFT mint
- Payment routing
- Project withdrawal
- Relevant fund transfers

Events should contain enough information to allow the future investigation application to reconstruct the scenario without depending on private application data.

---

## Database

Use PostgreSQL for application-level information.

The database may contain:

- Participant ID
- Role
- Assigned wallet address
- Authentication/account information
- Project metadata
- Scenario configuration
- Contract addresses
- Indexed transaction records
- NFT/application metadata where appropriate

The database is not the source of truth for blockchain transactions.

Confirmed blockchain state must come from the blockchain/RPC/indexing layer.

Do not allow private scenario instructions or the identity of the malicious participant to leak through public APIs.

---

## Transaction Handling

Never claim that a transaction succeeded merely because a transaction request was submitted.

The application should distinguish:

```text
Transaction requested
→ Pending
→ Confirmed
```

and handle:

```text
Rejected by user
Failed on-chain
Timed out / RPC error
```

Use ethers.js transaction receipts to determine confirmation.

Example pattern:

```typescript
const tx = await contract.someFunction();
const receipt = await tx.wait();

if (!receipt) {
  // Handle unconfirmed transaction
}
```

Store transaction hashes when appropriate.

---

## Network Validation

Before blockchain operations:

- Confirm the expected chain ID.
- Confirm configured contract addresses.
- Ensure the application is connected to local development or Sepolia.
- Do not silently switch to an unsupported network.

All addresses should be configurable through environment/configuration rather than scattered throughout the codebase.

---

## Explorer

The application includes a basic blockchain explorer for the role-play.

It should support:

- Wallet address search
- Transaction hash search
- Known scenario wallet histories
- Incoming native ETH transfers
- Outgoing native ETH transfers
- NFT mint and transfer events
- Transaction details
- Block number
- Timestamp
- Status
- Sender
- Recipient
- Value
- Links to wallet detail pages
- Links to project/contract information
- Public Sepolia explorer links

A normal RPC endpoint may not provide complete historical address transaction lists.

Use a lightweight indexing mechanism for the known scenario addresses and relevant contract events.

The blockchain remains the source of truth.

Do not build the future investigation application into this project.

---

## Organizer Operations

Organizer functionality should support:

- Creating/assigning participant accounts
- Assigning roles
- Assigning wallet addresses
- Configuring project metadata
- Configuring scenario parameters
- Setting Exchange 1
- Setting Exchange 2
- Distributing initial test ETH
- Monitoring participant progress
- Monitoring transaction status
- Viewing deployed contract addresses
- Viewing deployment information
- Resetting local development scenarios

A local-chain reset may erase local history.

Do not imply that Sepolia blockchain history can be erased.

For Sepolia rehearsals, use a new scenario deployment or new wallet set when required.

---

## Environment Variables

Use environment variables for:

- RPC endpoints
- Database connection
- Contract addresses
- Network configuration
- Organizer-only configuration
- Server secrets

Provide a safe `.env.example`.

Never commit:

- `.env`
- Private keys
- Seed phrases
- Passwords
- API secrets
- RPC credentials

---

## Development Process

Work incrementally.

Do not generate the complete application in one large change.

### Stage 1 — Inspect and Plan

First inspect:

- Existing repository
- Existing source files
- Package configuration
- Available development tools
- Existing environment configuration

Then propose:

1. Architecture
2. Repository structure
3. Dependencies
4. Database model
5. Contract design
6. Transaction flow
7. Development stages
8. Risks and unresolved decisions

Wait for approval before implementing the complete application.

### Stage 2 — Application Skeleton

Implement:

- Next.js + TypeScript
- Shared layout
- Login scaffolding
- Participant dashboard scaffolding
- Role-based navigation
- Organizer configuration
- Environment handling
- Basic validation
- Error states

Use mock blockchain data initially.

### Stage 3 — Smart Contracts

Implement and test:

- Project contract
- ERC-721 contract
- Marketplace/payment routing

Add a factory only when useful.

Test:

- Project creation
- NFT minting
- Payment routing
- Withdrawal permissions
- Accounting
- Events
- Unauthorized access
- Failed transactions
- Edge cases

### Stage 4 — Wallet Integration

Use:

- MetaMask
- ethers.js
- Assigned-wallet comparison
- Network validation
- Transaction submission
- Transaction status handling

Keep wallet authentication simple.

### Stage 5 — Participant Workflows

Implement:

- Creator dashboard
- Investor dashboard
- Mule dashboard

Keep the malicious storyline hidden from participants.

### Stage 6 — Indexing and Explorer

Implement:

- Scenario transaction indexing
- Contract event indexing
- Wallet histories
- Transaction details
- Search
- Public Sepolia links

### Stage 7 — End-to-End Testing

Simulate:

- All 15 participants
- All 17 wallets
- Initial funding
- Project deployment
- NFT minting
- Project fund accumulation
- Withdrawal
- Mule transfer
- Exchange 2 destination

Verify the expected on-chain evidence.

### Stage 8 — Sepolia Deployment

Deploy and verify contracts.

Then:

- Fund wallets with test ETH
- Configure the application
- Configure contract addresses
- Rehearse the entire scenario
- Verify transactions
- Fix issues before the live educational role-play

---

## Coding Guidelines

Prefer:

- Simple code
- Readable names
- Small functions
- Clear TypeScript types
- Straightforward React components
- Explicit error handling
- Reusable components where genuinely useful

Avoid:

- Unnecessary abstractions
- Over-engineering
- Unnecessary dependencies
- Duplicate blockchain logic
- Hardcoded wallet addresses throughout the codebase
- Frontend-only authorization
- Production-grade complexity that does not benefit the educational role-play

Do not change architecture unnecessarily.

When a design decision is unclear and materially affects the implementation, explain the trade-off and ask before proceeding.

Do not ask for confirmation for routine implementation details.

---

## Security Rules

Even though this is an educational simulation:

- Never use real funds.
- Never use Ethereum Mainnet.
- Never store private keys in the database.
- Never store seed phrases.
- Never expose organizer private keys to the browser.
- Never commit secrets.
- Validate chain IDs.
- Validate contract addresses.
- Validate user input.
- Use OpenZeppelin contracts where appropriate.
- Protect payable functions against reentrancy and accounting errors.
- Enforce contract permissions.
- Enforce role permissions server-side.
- Do not rely on hidden UI elements as security.
- Do not implement real exchange functionality.
- Do not implement real-money deposits or withdrawals.

---

## Testing

Run relevant tests after meaningful changes.

For smart contracts, test:

- Happy paths
- Unauthorized callers
- Incorrect payments
- Incorrect project selection
- Withdrawal permissions
- Accounting
- Event emission
- Failed transactions
- Edge cases

For the application, test:

- Login
- Role assignment
- Wallet connection
- Wrong wallet rejection
- Account switching
- Network validation
- Transaction states
- Role-specific access
- API authorization

Do not claim that code works without actually testing it when testing is possible.

---

## Documentation

Keep documentation updated when architecture or setup changes.

Document:

- Environment variables
- Local setup
- Database setup
- Contract deployment
- Contract addresses
- Network configuration
- Wallet assignment
- Organizer setup
- Participant setup
- Running the application
- Running tests
- Sepolia deployment
- Role-play procedure

Clearly distinguish:

```text
Application state
vs.
Confirmed blockchain state
```

---

## Important Working Principle

This project is an educational role-play, not a production financial application.

The implementation should therefore prioritize:

1. Correct blockchain behavior
2. Clear demonstration of the fraud flow
3. Simple participant experience
4. Easy setup and rehearsal
5. Understandable code
6. Reliable on-chain evidence

Do not add complexity unless it directly improves one of these goals.

When implementing new functionality, preserve the existing project requirements and avoid changing unrelated parts of the architecture.
