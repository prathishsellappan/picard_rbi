import "server-only";
import { JsonRpcProvider } from "ethers";
import { getServerConfig } from "./config";

// Server-side RPC access. The provider is pinned to the configured chain, and on first use we
// confirm the RPC endpoint really serves that chain, so a misconfigured RPC_URL (e.g. a mainnet
// endpoint) fails loudly instead of being trusted.

const globalForChain = globalThis as unknown as { picardProvider?: Promise<JsonRpcProvider> };

async function createProvider(): Promise<JsonRpcProvider> {
  const { rpcUrl, chain } = getServerConfig();
  // cacheTimeout -1: ethers otherwise reuses identical RPC answers for 250 ms, which would
  // return a stale "no receipt yet" when a participant re-checks a pending transaction.
  const provider = new JsonRpcProvider(rpcUrl, chain.id, { staticNetwork: true, cacheTimeout: -1 });
  const actual = Number(await provider.send("eth_chainId", []));
  if (actual !== chain.id) {
    throw new Error(`RPC_URL serves chain ${actual}, but the app is configured for ${chain.id}.`);
  }
  return provider;
}

export function getProvider(): Promise<JsonRpcProvider> {
  if (!globalForChain.picardProvider) {
    globalForChain.picardProvider = createProvider().catch((error) => {
      globalForChain.picardProvider = undefined; // retry on the next call
      throw error;
    });
  }
  return globalForChain.picardProvider;
}
