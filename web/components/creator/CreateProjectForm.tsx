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

type Props = { factory: string; minPriceWei: string; maxPriceWei: string; allowed: boolean };
type Draft = { name: string; description: string; price: bigint };

const MAX_NAME_BYTES = 64;

export function CreateProjectForm({ factory, minPriceWei, maxPriceWei, allowed }: Props) {
  const router = useRouter();
  const wallet = useWallet();
  const ready = wallet.status === "ready";
  const tx = useTransaction("create_project", () => router.refresh());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(formatEther(minPriceWei));
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Draft | null>(null);
  const min = BigInt(minPriceWei);
  const max = BigInt(maxPriceWei);

  function onReview(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    tx.reset();
    const trimmed = name.trim();
    const nameBytes = new TextEncoder().encode(trimmed).length;
    if (nameBytes === 0 || nameBytes > MAX_NAME_BYTES) return setError("Project name must be 1–64 characters.");
    if (description.length > 1000) return setError("Description must be at most 1000 characters.");
    const value = parseEthAmount(price);
    if (value === null || value < min || value > max) {
      return setError(`Mint price must be between ${formatEther(min)} and ${formatEther(max)} ETH.`);
    }
    setReview({ name: trimmed, description: description.trim(), price: value });
  }

  async function onConfirm() {
    if (!review) return;
    const draft = review;
    setReview(null);
    await tx.run(
      (signer) => new Contract(factory, ABI.ProjectFactory, signer).createProject(draft.name, draft.price, ""),
      { description: draft.description },
    );
  }

  if (!allowed) {
    return (
      <p className="text-sm text-slate-600">
        Your wallet isn&apos;t approved on the project factory yet. The organizer will enable project creation.
      </p>
    );
  }

  return (
    <div>
      {!review ? (
        <form onSubmit={onReview} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Project name"
            aria-label="Project name"
            maxLength={64}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Description (shown in the marketplace)"
            aria-label="Description"
            rows={3}
            maxLength={1000}
          />
          <label className="block text-xs text-slate-600">
            Mint price in ETH ({formatEther(min)}–{formatEther(max)})
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
              aria-label="Mint price in ETH"
              inputMode="decimal"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={!ready || tx.busy} className={buttonClass}>
            Review project
          </button>
          {!ready && <p className="text-xs text-slate-500">Connect your assigned wallet first.</p>}
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="font-medium">This deploys your project contract. It can&apos;t be changed later:</p>
          <p>
            <span className="text-slate-500">Name: </span>
            {review.name}
          </p>
          <p>
            <span className="text-slate-500">Mint price: </span>
            {formatEther(review.price)} test ETH
          </p>
          {review.description && <p className="text-slate-600">{review.description}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onConfirm} className={buttonClass}>
              Deploy with MetaMask
            </button>
            <button
              type="button"
              onClick={() => setReview(null)}
              className="rounded px-4 py-2 text-sm hover:bg-slate-100"
            >
              Back
            </button>
          </div>
        </div>
      )}
      <TxStatus state={tx.state} onRecheck={tx.recheck} />
    </div>
  );
}
