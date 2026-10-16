"use client";

import { Contract, formatEther } from "ethers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { TxStatus } from "@/components/wallet/TxStatus";
import { useTransaction } from "@/components/wallet/useTransaction";
import { useWallet } from "@/components/wallet/WalletProvider";
import { ABI } from "@/lib/abi";

// Mints one NFT for `project` through the marketplace, paying exactly the project's mint price.
// The marketplace forwards the payment to the project contract.
export function MintButton({
  marketplace,
  project,
  projectName,
  mintPriceWei,
}: {
  marketplace: string;
  project: string;
  projectName: string;
  mintPriceWei: string;
}) {
  const router = useRouter();
  const wallet = useWallet();
  const ready = wallet.status === "ready";
  const tx = useTransaction("mint", () => router.refresh());
  const [confirming, setConfirming] = useState(false);
  const price = BigInt(mintPriceWei);

  async function onMint() {
    setConfirming(false);
    await tx.run((signer) => new Contract(marketplace, ABI.Marketplace, signer).mint(project, { value: price }));
  }

  return (
    <div>
      {confirming ? (
        <div className="space-y-2 text-sm">
          <p>
            Mint 1 <strong>{projectName}</strong> NFT for {formatEther(price)} test ETH (plus gas)?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onMint} className={buttonClass}>
              Confirm in MetaMask
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded px-3 py-2 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            tx.reset();
            setConfirming(true);
          }}
          disabled={!ready || tx.busy}
          className={`${buttonClass} w-full`}
        >
          {tx.busy ? "Minting…" : "Mint NFT"}
        </button>
      )}
      <TxStatus state={tx.state} onRecheck={tx.recheck} />
    </div>
  );
}
