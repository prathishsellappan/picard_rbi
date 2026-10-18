// Display labels for transaction kinds (client-safe; tx-verify.ts is server-only).
export const TX_LABELS: Record<string, string> = {
  transfer: "Send test ETH",
  mule_transfer: "Final transfer (fixed destination)",
  create_project: "Create project",
  withdraw: "Withdraw project funds",
  mint: "Mint NFT",
};
