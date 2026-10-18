import { Card } from "./ui";

export function ContractsNotReady({ message }: { message: string }) {
  return (
    <Card title="Not available yet">
      <p className="text-[13px] text-ink-soft">{message}</p>
    </Card>
  );
}
