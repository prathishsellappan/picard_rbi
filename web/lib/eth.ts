import { formatEther, parseEther } from "ethers";

// Parses a user-entered ETH amount into wei. Returns null for invalid or negative input.
export function parseEthAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

export function formatEth(wei: string | bigint): string {
  return formatEther(BigInt(wei));
}
