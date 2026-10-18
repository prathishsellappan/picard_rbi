"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

// Segmented control: a beige track with the current page in saffron.
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-0.5 rounded-[9px] border border-line bg-paper-deep p-[3px]">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-[7px] px-3 py-1 text-[12px] font-medium ${
              active ? "bg-saffron text-on-primary" : "text-ink-soft hover:bg-card-tint hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
