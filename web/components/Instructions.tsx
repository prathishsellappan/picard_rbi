import { Card } from "./ui";

export function Instructions({ text }: { text: string }) {
  return (
    <Card title="Your instructions">
      <p className="whitespace-pre-wrap text-[13px] text-ink-soft">{text || "No instructions yet."}</p>
    </Card>
  );
}
