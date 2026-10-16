// Pure wallet-state rules, shared by the browser wallet provider and unit tests.

export type WalletStatus =
  | "no-wallet" // MetaMask not installed
  | "disconnected" // installed, but this site has no connected account
  | "wrong-account" // connected account is not the participant's assigned wallet
  | "wrong-network" // right account, unsupported or unexpected chain
  | "ready"; // assigned wallet on the configured chain: transactions allowed

export type WalletSnapshot = {
  hasProvider: boolean;
  accounts: string[];
  chainId: number | null;
};

export function evaluateWallet(
  snapshot: WalletSnapshot,
  assignedWallet: string,
  expectedChainId: number,
): WalletStatus {
  if (!snapshot.hasProvider) return "no-wallet";
  const current = snapshot.accounts[0];
  if (!current) return "disconnected";
  if (current.toLowerCase() !== assignedWallet.toLowerCase()) return "wrong-account";
  if (snapshot.chainId !== expectedChainId) return "wrong-network";
  return "ready";
}

// MetaMask reports chain IDs as hex strings ("0x7a69").
export function parseChainIdHex(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return null;
  return Number.parseInt(value, 16);
}

export function toChainIdHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}
