"use client";

import { Card } from "@/components/ui";
import type { TxKind } from "@/lib/tx-verify";
import { MyTransactionsList, useMyTransactions } from "./MyTransactions";
import { SendEthForm } from "./SendEthForm";

// A send form plus the participant's own transaction list, refreshed after each send settles.
export function TransferSection({
  title,
  kind,
  fixedRecipient,
}: {
  title: string;
  kind: TxKind;
  fixedRecipient?: { address: string; label: string };
}) {
  const { rows, reload } = useMyTransactions();
  return (
    <>
      <Card title={title}>
        <SendEthForm kind={kind} fixedRecipient={fixedRecipient} onSent={reload} />
      </Card>
      <Card title="My transactions">
        <MyTransactionsList rows={rows} />
      </Card>
    </>
  );
}
