"use client";

import { formatEther } from "ethers";
import { useEffect, useState } from "react";
import { Card, Mono, buttonClass } from "@/components/ui";
import { shortAddress } from "@/lib/address";
import { getConfiguredChain } from "@/lib/chains";
import { statusMessage, useWallet } from "./WalletProvider";

export function WalletPanel() {
  const wallet = useWallet();
  const chain = getConfiguredChain();
  const balance = useBalance(wallet.status === "ready" ? wallet.assignedWallet : null);

  const tone =
    wallet.status === "ready"
      ? "text-green-deep"
      : wallet.status === "wrong-account" || wallet.status === "wrong-network"
        ? "text-amber"
        : "text-ink-soft";

  return (
    <Card title="Your wallet">
      <p className="text-[13px] text-ink-muted">Assigned wallet</p>
      <Mono>{wallet.assignedWallet}</Mono>

      {wallet.connectedAddress && wallet.status === "wrong-account" && (
        <>
          <p className="mt-2 text-[13px] text-ink-muted">Connected in MetaMask</p>
          <Mono>{wallet.connectedAddress}</Mono>
        </>
      )}

      <p role="status" className={`mt-3 text-[13px] font-medium ${tone}`}>
        {wallet.checked ? statusMessage(wallet.status, chain.name) : "Checking MetaMask…"}
      </p>
      {wallet.error && <p className="mt-1 text-[13px] text-amber">{wallet.error}</p>}
      {wallet.status === "wrong-account" && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-ink-soft">
          <li>
            Click <strong>Choose account in MetaMask</strong>.
          </li>
          <li>
            In the MetaMask window, select only the account ending in{" "}
            <strong className="font-mono">{wallet.assignedWallet.slice(-4)}</strong> (
            <span className="font-mono">{shortAddress(wallet.assignedWallet)}</span>) and confirm.
          </li>
          <li>If that account isn&apos;t in MetaMask, ask the organizer to import it for you.</li>
        </ol>
      )}
      {wallet.status === "wrong-network" && <NetworkHelp currentChainId={wallet.chainId} />}
      {wallet.status === "ready" && balance !== null && (
        <p className="mt-1 text-[13px] text-ink-soft">Balance: {formatEther(balance)} test ETH</p>
      )}

      <div className="mt-3 flex gap-2">
        {wallet.status === "wrong-account" && (
          <button type="button" onClick={wallet.chooseAccount} disabled={wallet.connecting} className={buttonClass}>
            {wallet.connecting ? "Waiting for MetaMask…" : "Choose account in MetaMask"}
          </button>
        )}
        {(wallet.status === "disconnected" || wallet.status === "no-wallet") && (
          <button type="button" onClick={wallet.connect} disabled={wallet.connecting} className={buttonClass}>
            {wallet.connecting ? "Connecting…" : "Connect MetaMask"}
          </button>
        )}
        {wallet.status === "wrong-network" && (
          <button type="button" onClick={wallet.switchNetwork} className={buttonClass}>
            Switch to {chain.name}
          </button>
        )}
      </div>
    </Card>
  );
}

// Reads the balance through MetaMask's provider, refreshing every few seconds.
export function useBalance(address: string | null): bigint | null {
  const { getVerifiedSigner } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const update = async () => {
      try {
        const signer = await getVerifiedSigner();
        const value = await signer.provider.getBalance(address);
        if (!cancelled) setBalance(value);
      } catch {
        // Wallet state changed; the panel already shows why.
      }
    };
    update();
    const timer = setInterval(update, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [address, getVerifiedSigner]);

  return address ? balance : null;
}

// Shown while MetaMask is on the wrong network: what it is on now, and the exact settings to add
// the expected network by hand if the Switch button can't.
function NetworkHelp({ currentChainId }: { currentChainId: number | null }) {
  const chain = getConfiguredChain();
  return (
    <div className="mt-3 rounded-[9px] border border-line-strong bg-paper-deep/60 p-3 text-[13px] text-ink-soft">
      <p>
        MetaMask is on chain ID <strong>{currentChainId ?? "unknown"}</strong>; this role-play uses{" "}
        <strong>{chain.id}</strong>. Click <strong>Switch to {chain.name}</strong>. If that doesn&apos;t work:
      </p>
      {chain.walletRpcUrl ? (
        <>
          <p className="mt-2">
            In MetaMask open the network menu → <strong>Add a custom network</strong> (or Settings → Networks → Add
            network → Add a network manually) and enter:
          </p>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-muted">Network name</dt>
            <dd>{chain.name}</dd>
            <dt className="text-ink-muted">RPC URL</dt>
            <dd className="font-mono">{chain.walletRpcUrl}</dd>
            <dt className="text-ink-muted">Chain ID</dt>
            <dd className="font-mono">{chain.id}</dd>
            <dt className="text-ink-muted">Currency symbol</dt>
            <dd>ETH</dd>
          </dl>
          <p className="mt-2">
            Save, select that network in MetaMask, then come back here. If MetaMask says the RPC URL can&apos;t be
            reached, the organizer&apos;s local chain isn&apos;t running.
          </p>
        </>
      ) : (
        <p className="mt-2">
          In MetaMask open the network menu, turn on <strong>Show test networks</strong>, and select{" "}
          <strong>{chain.name}</strong>.
        </p>
      )}
    </div>
  );
}
