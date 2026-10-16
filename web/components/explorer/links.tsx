import { getAddress } from "ethers";
import Link from "next/link";
import { shortAddress } from "@/lib/address";
import { explorerAddressUrl, explorerTxUrl, getConfiguredChain } from "@/lib/chains";
import type { Labels } from "@/lib/explorer";

export function AddressLink({ address, labels }: { address: string | null; labels: Labels }) {
  if (!address) return <span className="text-slate-400">—</span>;
  const label = labels.get(address.toLowerCase());
  address = getAddress(address.toLowerCase());
  return (
    <Link href={`/explorer/address/${address}`} className="underline decoration-slate-300 hover:decoration-slate-700">
      {label ? (
        <span>
          {label} <span className="font-mono text-xs text-slate-500">{shortAddress(address)}</span>
        </span>
      ) : (
        <span className="font-mono text-xs">{shortAddress(address)}</span>
      )}
    </Link>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <Link
      href={`/explorer/tx/${hash}`}
      className="font-mono text-xs underline decoration-slate-300 hover:decoration-slate-700"
    >
      {shortAddress(hash)}
    </Link>
  );
}

// Link to the public Sepolia explorer; nothing on the local chain.
export function PublicExplorerLink({ kind, value }: { kind: "address" | "tx"; value: string }) {
  const chain = getConfiguredChain();
  const url = kind === "tx" ? explorerTxUrl(chain, value) : explorerAddressUrl(chain, value);
  if (!url) return <span className="text-xs text-slate-500">(local chain: no public explorer)</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs underline">
      View on Etherscan (Sepolia) ↗
    </a>
  );
}
