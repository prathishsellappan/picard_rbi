import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { secondaryButtonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { NAV_BY_ROLE } from "@/lib/nav";
import { roleOf } from "@/lib/roles";
import { logoutAction } from "../actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Layouts don't re-run on every navigation, so each page also checks its own role.
  const user = await requireUser();
  const role = roleOf(user);
  const who = user.kind === "organizer" ? `Organizer (${user.username})` : `${user.displayName} (${user.username})`;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--color-card)_85%,transparent)] backdrop-blur-[8px]">
        <div className="mx-auto flex min-h-[58px] max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[15px] font-semibold tracking-tight text-green-deep">PICARD</span>
            <AppNav items={NAV_BY_ROLE[role]} />
          </div>
          <div className="flex items-center gap-2 text-[12px] text-ink-muted">
            <span className="mr-1">{who}</span>
            <ThemeToggle />
            <form action={logoutAction}>
              <button type="submit" className={secondaryButtonClass}>
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
