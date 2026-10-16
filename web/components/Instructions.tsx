import { Card } from "./ui";

export function Instructions({ text }: { text: string }) {
  return (
    <Card title="Your instructions">
      <p className="whitespace-pre-wrap text-sm text-slate-700">{text || "No instructions yet."}</p>
    </Card>
  );
}
