"use client";

import { Contract, formatEther } from "ethers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { TxStatus } from "@/components/wallet/TxStatus";
import { useTransaction } from "@/components/wallet/useTransaction";
import { useWallet } from "@/components/wallet/WalletProvider";
import { ABI } from "@/lib/abi";
import { parseEthAmount } from "@/lib/eth";

// Withdraws project funds to the creator's own wallet (the contract allows no other destination).
export function WithdrawForm({ project, availableWei }: { project: string; availableWei: string }) {
  const router = useRouter();
  const wallet = useWallet();
  const ready = wallet.status === "ready";
  const tx = useTransaction("withdraw", () => router.refresh());
  const available = BigInt(availableWei);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = parseEthAmount(amount);
    if (value === null || value <= 0n) return setError("Enter an amount greater than 0.");
    if (value > available) return setError(`At most ${formatEther(available)} ETH is available.`);
    await tx.run((signer) => new Contract(project, ABI.Project, signer).withdraw(value));
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="Amount (ETH)"
            aria-label="Withdraw amount in ETH"
            inputMode="decimal"
          />
          <button type="button" onClick={() => setAmount(formatEther(available))} className="text-sm underline">
            Max
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={!ready || tx.busy || available === 0n} className={buttonClass}>
          Withdraw to my wallet
        </button>
        {available === 0n && <p className="text-xs text-slate-500">No funds available to withdraw.</p>}
      </form>
      <TxStatus state={tx.state} onRecheck={tx.recheck} />
    </div>
  );
}
