import type { ReactNode } from "react";

// Shared building blocks in the PICARD style: off-white cards with tan hairlines (no shadows),
// small dense type, saffron for the one primary action, recessed beige wells for inputs.

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="fade-up rounded-xl border border-line bg-card p-[14px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// Small uppercase label used to separate sections inside a card.
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{children}</h3>;
}

// Dashed "empty state" box; also used for placeholder notices.
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[9px] border border-dashed border-line-strong px-3 py-3 text-[11px] text-ink-faint">
      {children}
    </p>
  );
}

export function MockNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-3">
      <EmptyState>Mock data — not blockchain state. {children}</EmptyState>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</p>}
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-[11.5px] text-ink">{children}</span>;
}

// Status chips: green = success, amber = in progress / needs attention, red = failed.
export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "confirmed"
      ? "bg-green-tint text-green-deep border-green/40"
      : status === "failed" || status === "rejected"
        ? "bg-flag-tint text-flag-deep border-flag/40"
        : "bg-amber-tint text-amber border-amber/40";
  return (
    <span className={`inline-block rounded-[6px] border px-1.5 py-px text-[10.5px] font-semibold ${color}`}>
      {status}
    </span>
  );
}

// Text inputs are recessed "wells".
export const inputClass =
  "w-full rounded-[9px] border border-line-strong bg-paper-deep px-3 py-2 text-[13px] text-ink focus:border-saffron focus:outline-none";
// Primary action: saffron. Use one per area.
export const buttonClass =
  "rounded-[8px] bg-saffron px-3 py-[7px] text-[12px] font-semibold text-on-primary hover:bg-saffron-mark disabled:cursor-not-allowed disabled:opacity-40";
// Secondary action: off-white with a tan border.
export const secondaryButtonClass =
  "rounded-[8px] border border-line-strong bg-card px-3 py-[7px] text-[12px] font-medium text-ink-soft hover:bg-card-tint disabled:cursor-not-allowed disabled:opacity-40";
// Text links: saffron-deep with a tan underline that turns saffron on hover.
export const linkClass =
  "text-saffron-deep underline decoration-line-strong underline-offset-2 hover:decoration-saffron";
// Messages
export const errorTextClass = "text-[12px] text-flag-deep";
export const warnTextClass = "text-[12px] text-amber";
export const successTextClass = "text-[12px] text-green-deep";
