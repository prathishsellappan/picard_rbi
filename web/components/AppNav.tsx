"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded px-3 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
