import type { ReactNode } from "react";

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function MockNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="mb-3 rounded border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-800">
      Mock data — not blockchain state. {children}
    </p>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs">{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "confirmed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed" || status === "rejected" || status === "timeout"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

export const inputClass =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
export const buttonClass =
  "rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400";
