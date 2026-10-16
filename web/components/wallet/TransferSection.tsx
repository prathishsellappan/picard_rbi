"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { OwnTxRow, TxKind } from "@/lib/tx-verify";
import { MyTransactionsList } from "./MyTransactions";
import { SendEthForm } from "./SendEthForm";

// A send form plus the participant's own transactions. `rows` come from the server; the page is
// refreshed after each transaction settles so every panel shows the latest chain-checked state.
export function TransferSection({
  title,
  kind,
  rows,
  fixedRecipient,
}: {
  title: string;
  kind: TxKind;
  rows: OwnTxRow[];
  fixedRecipient?: { address: string; label: string };
}) {
  const router = useRouter();
  return (
    <>
      <Card title={title}>
        <SendEthForm kind={kind} fixedRecipient={fixedRecipient} onSent={() => router.refresh()} />
      </Card>
      <Card title="My transactions">
        <MyTransactionsList rows={rows} />
      </Card>
    </>
  );
}
