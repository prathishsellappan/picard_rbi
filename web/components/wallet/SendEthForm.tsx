"use client";

import { formatEther } from "ethers";
import { useState } from "react";
import { buttonClass, inputClass, linkClass, Mono, secondaryButtonClass } from "@/components/ui";
import { normalizeAddress, sameAddress } from "@/lib/address";
import { parseEthAmount } from "@/lib/eth";
import type { TxKind } from "@/lib/tx-verify";
import { TxStatus } from "./TxStatus";
import { useTransaction } from "./useTransaction";
import { useBalance } from "./WalletPanel";
import { useWallet } from "./WalletProvider";

const GAS_LIMIT = 21_000n;

type Props = {
  kind: TxKind;
  // When set, the recipient is fixed (mule → Exchange 2) and not editable.
  fixedRecipient?: { address: string; label: string };
  onSent?: () => void;
};

type Review = { to: string; value: bigint };

export function SendEthForm({ kind, fixedRecipient, onSent }: Props) {
  const wallet = useWallet();
  const ready = wallet.status === "ready";
  const balance = useBalance(ready ? wallet.assignedWallet : null);
  const tx = useTransaction(kind, onSent);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  // Keeps enough for gas at roughly twice the current fee, so the transfer itself can't strand the wallet.
  async function gasReserve(): Promise<bigint> {
    const signer = await wallet.getVerifiedSigner();
    const fees = await signer.provider.getFeeData();
    return GAS_LIMIT * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n) * 2n;
  }

  async function fillMax() {
    setError(null);
    if (balance === null) return;
    const max = balance - (await gasReserve());
    setAmount(max > 0n ? formatEther(max) : "0");
  }

  async function onReview(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    tx.reset();

    const to = fixedRecipient ? fixedRecipient.address : normalizeAddress(recipient);
    if (!to)
      return setError(
        "Enter a valid Ethereum address (check for typos — mixed-case addresses must match their checksum).",
      );
    if (sameAddress(to, wallet.assignedWallet)) return setError("You can't send to your own wallet.");
    const value = parseEthAmount(amount);
    if (value === null || value <= 0n) return setError("Enter an amount greater than 0, e.g. 0.01");
    if (balance === null) return setError("Balance not loaded yet. Try again in a moment.");
    const reserve = await gasReserve();
    if (value + reserve > balance) {
      return setError(`Not enough test ETH. Keep about ${formatEther(reserve)} ETH for gas.`);
    }
    setReview({ to, value });
  }

  async function onConfirm() {
    if (!review) return;
    const { to, value } = review;
    setReview(null);
    await tx.run((signer) => signer.sendTransaction({ to, value }));
  }

  return (
    <div>
      {!review ? (
        <form onSubmit={onReview} className="space-y-3">
          {fixedRecipient ? (
            <div className="text-[13px]">
              <p className="text-ink-muted">Recipient ({fixedRecipient.label})</p>
              <Mono>{fixedRecipient.address}</Mono>
            </div>
          ) : (
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className={`${inputClass} font-mono`}
              placeholder="Recipient address (0x…)"
              aria-label="Recipient address"
              spellCheck={false}
              autoComplete="off"
            />
          )}
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              placeholder="Amount (ETH)"
              aria-label="Amount in ETH"
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={fillMax}
              disabled={!ready || balance === null}
              className={`text-[12px] ${linkClass} disabled:opacity-40`}
            >
              Max
            </button>
          </div>
          {error && <p className="text-[13px] text-amber">{error}</p>}
          <button type="submit" disabled={!ready || tx.busy} className={buttonClass}>
            Review transfer
          </button>
          {!ready && <p className="text-[11.5px] text-ink-muted">Connect your assigned wallet first.</p>}
        </form>
      ) : (
        <div className="space-y-3 text-[13px]">
          <p className="font-medium">Check before sending:</p>
          <p>
            <span className="text-ink-muted">To: </span>
            <Mono>{review.to}</Mono>
          </p>
          <p>
            <span className="text-ink-muted">Amount: </span>
            {formatEther(review.value)} test ETH
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onConfirm} className={buttonClass}>
              Send with MetaMask
            </button>
            <button type="button" onClick={() => setReview(null)} className={secondaryButtonClass}>
              Back
            </button>
          </div>
        </div>
      )}
      <TxStatus state={tx.state} onRecheck={tx.recheck} />
    </div>
  );
}
