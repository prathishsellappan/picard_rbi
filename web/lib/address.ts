import { getAddress, isAddress, ZeroAddress } from "ethers";

// Returns the checksummed address, or null if the input is not a valid non-zero address.
export function normalizeAddress(input: string): string | null {
  const trimmed = input.trim();
  if (!isAddress(trimmed)) return null;
  const checksummed = getAddress(trimmed);
  return checksummed === ZeroAddress ? null : checksummed;
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
