// Supported networks. Shared by server and browser code.
// Anything not in this list — including Ethereum Mainnet — is refused.

export type SupportedChain = {
  id: number;
  name: string;
  explorerUrl: string | null;
  // Used only when asking MetaMask to add the network (Sepolia is built into MetaMask).
  walletRpcUrl: string | null;
};

export const SUPPORTED_CHAINS: Record<number, SupportedChain> = {
  31337: { id: 31337, name: "Local Hardhat", explorerUrl: null, walletRpcUrl: "http://127.0.0.1:8545" },
  11155111: { id: 11155111, name: "Sepolia", explorerUrl: "https://sepolia.etherscan.io", walletRpcUrl: null },
};

export function getSupportedChain(chainId: number): SupportedChain {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) {
    throw new Error(
      `Unsupported chain ID ${chainId}. Only local development (31337) and Sepolia (11155111) are allowed.`,
    );
  }
  return chain;
}

export function parseChainId(raw: string | undefined): SupportedChain {
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("NEXT_PUBLIC_CHAIN_ID must be set to 31337 or 11155111.");
  }
  return getSupportedChain(Number(raw));
}

// The chain this deployment is configured for. NEXT_PUBLIC_ vars are inlined at build time,
// so the browser and server agree on the same value.
export function getConfiguredChain(): SupportedChain {
  return parseChainId(process.env.NEXT_PUBLIC_CHAIN_ID);
}

export function explorerTxUrl(chain: SupportedChain, txHash: string): string | null {
  return chain.explorerUrl ? `${chain.explorerUrl}/tx/${txHash}` : null;
}

export function explorerAddressUrl(chain: SupportedChain, address: string): string | null {
  return chain.explorerUrl ? `${chain.explorerUrl}/address/${address}` : null;
}
