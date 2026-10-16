import { Card, Mono } from "./ui";

// Stage 2 placeholder. Stage 4 adds MetaMask connection, the assigned-wallet comparison,
// chain validation, and account-change detection.
export function AssignedWallet({ address }: { address: string }) {
  return (
    <Card title="Your wallet">
      <p className="text-sm text-slate-600">Assigned wallet</p>
      <Mono>{address}</Mono>
      <div className="mt-3 flex items-center gap-3">
        <button disabled className="rounded bg-slate-300 px-4 py-2 text-sm text-slate-600">
          Connect MetaMask
        </button>
        <span className="text-xs text-slate-500">Wallet connection arrives in Stage 4.</span>
      </div>
    </Card>
  );
}
