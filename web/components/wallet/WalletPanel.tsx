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
      ? "text-emerald-700"
      : wallet.status === "wrong-account" || wallet.status === "wrong-network"
        ? "text-red-700"
        : "text-slate-600";

  return (
    <Card title="Your wallet">
      <p className="text-sm text-slate-500">Assigned wallet</p>
      <Mono>{wallet.assignedWallet}</Mono>

      {wallet.connectedAddress && wallet.status === "wrong-account" && (
        <>
          <p className="mt-2 text-sm text-slate-500">Connected in MetaMask</p>
          <Mono>{wallet.connectedAddress}</Mono>
        </>
      )}

      <p role="status" className={`mt-3 text-sm font-medium ${tone}`}>
        {wallet.checked ? statusMessage(wallet.status, chain.name) : "Checking MetaMask…"}
      </p>
      {wallet.error && <p className="mt-1 text-sm text-red-700">{wallet.error}</p>}
      {wallet.status === "wrong-account" && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
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
      {wallet.status === "ready" && balance !== null && (
        <p className="mt-1 text-sm text-slate-600">Balance: {formatEther(balance)} test ETH</p>
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
