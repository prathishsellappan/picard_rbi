"use client";

import { BrowserProvider, type JsonRpcSigner } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getConfiguredChain } from "@/lib/chains";
import {
  evaluateWallet,
  parseChainIdHex,
  toChainIdHex,
  type WalletSnapshot,
  type WalletStatus,
} from "@/lib/wallet/state";
import type { InjectedProvider } from "@/lib/wallet/ethereum";

type WalletContextValue = {
  status: WalletStatus;
  checked: boolean; // false until the first silent MetaMask check finishes
  assignedWallet: string;
  connectedAddress: string | null;
  chainId: number | null;
  error: string | null;
  connecting: boolean;
  connect(): Promise<void>;
  switchNetwork(): Promise<void>;
  // Re-checks account and chain with MetaMask right before signing. Throws if not ready.
  getVerifiedSigner(): Promise<JsonRpcSigner>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const EMPTY: WalletSnapshot = { hasProvider: false, accounts: [], chainId: null };

function injected(): InjectedProvider | null {
  return typeof window !== "undefined" && window.ethereum ? window.ethereum : null;
}

async function readSnapshot(eth: InjectedProvider, prompt: boolean): Promise<WalletSnapshot> {
  const accounts = (await eth.request({ method: prompt ? "eth_requestAccounts" : "eth_accounts" })) as string[];
  const chainId = parseChainIdHex(await eth.request({ method: "eth_chainId" }));
  return { hasProvider: true, accounts, chainId };
}

// `assignedWallet` comes from the server session. This client-side match is a usability
// check; the server independently verifies the sender of every reported transaction.
export function WalletProvider({ assignedWallet, children }: { assignedWallet: string; children: ReactNode }) {
  const chain = getConfiguredChain();
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(EMPTY);
  const [provider, setProvider] = useState<InjectedProvider | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async (prompt: boolean) => {
    const eth = injected();
    setProvider(eth);
    setSnapshot(eth ? await readSnapshot(eth, prompt) : EMPTY);
  }, []);

  // Silent check on load: no MetaMask popup until the participant clicks Connect.
  useEffect(() => {
    const eth = injected();
    Promise.resolve(eth ? readSnapshot(eth, false) : EMPTY)
      .then((s) => {
        setSnapshot(s);
        setProvider(eth);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  // Follow account and network changes; the status re-evaluates on every change.
  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (accounts: unknown) =>
      setSnapshot((s) => ({
        ...s,
        hasProvider: true,
        accounts: Array.isArray(accounts) ? (accounts as string[]) : [],
      }));
    const onChain = (chainId: unknown) => setSnapshot((s) => ({ ...s, chainId: parseChainIdHex(chainId) }));
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    setError(null);
    if (!injected()) {
      setSnapshot(EMPTY);
      setChecked(true);
      setError("MetaMask was not found in this browser.");
      return;
    }
    setConnecting(true);
    try {
      await refresh(true);
    } catch (e) {
      setError(
        (e as { code?: number }).code === 4001 ? "Connection request was rejected." : "Could not connect to MetaMask.",
      );
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  // Only runs when the participant clicks the button; the app never switches networks silently.
  const switchNetwork = useCallback(async () => {
    const eth = injected();
    if (!eth) return;
    setError(null);
    const chainIdHex = toChainIdHex(chain.id);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 4902 && chain.walletRpcUrl) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: chain.name,
              rpcUrls: [chain.walletRpcUrl],
              nativeCurrency: { name: "Test ETH", symbol: "ETH", decimals: 18 },
            },
          ],
        });
      } else {
        setError(code === 4001 ? "Network switch was rejected." : `Please switch MetaMask to ${chain.name}.`);
      }
    }
    await refresh(false).catch(() => {});
  }, [chain, refresh]);

  const getVerifiedSigner = useCallback(async () => {
    const eth = injected();
    if (!eth) throw new Error("MetaMask was not found.");
    const fresh = await readSnapshot(eth, false);
    setSnapshot(fresh);
    const status = evaluateWallet(fresh, assignedWallet, chain.id);
    if (status !== "ready") throw new Error(statusMessage(status, chain.name));
    // Pinning the network makes ethers refuse to sign if the chain changes underneath it.
    const signer = await new BrowserProvider(eth, chain.id).getSigner();
    if ((await signer.getAddress()).toLowerCase() !== assignedWallet.toLowerCase()) {
      throw new Error(statusMessage("wrong-account", chain.name));
    }
    return signer;
  }, [assignedWallet, chain]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status: evaluateWallet(snapshot, assignedWallet, chain.id),
      checked,
      assignedWallet,
      connectedAddress: snapshot.accounts[0] ?? null,
      chainId: snapshot.chainId,
      error,
      connecting,
      connect,
      switchNetwork,
      getVerifiedSigner,
    }),
    [snapshot, checked, assignedWallet, chain.id, error, connecting, connect, switchNetwork, getVerifiedSigner],
  );

  return <WalletContext value={value}>{children}</WalletContext>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function statusMessage(status: WalletStatus, chainName: string): string {
  switch (status) {
    case "no-wallet":
      return "MetaMask is not installed in this browser. Ask the organizer for help.";
    case "disconnected":
      return "Connect MetaMask to continue.";
    case "wrong-account":
      return "This is not your assigned wallet. Please connect your assigned wallet in MetaMask.";
    case "wrong-network":
      return `MetaMask is on the wrong network. Switch to ${chainName}.`;
    case "ready":
      return "Assigned wallet connected.";
  }
}
