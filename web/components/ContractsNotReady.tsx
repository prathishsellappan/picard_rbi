import { Card } from "./ui";

export function ContractsNotReady({ message }: { message: string }) {
  return (
    <Card title="Not available yet">
      <p className="text-sm text-slate-600">{message}</p>
    </Card>
  );
}
