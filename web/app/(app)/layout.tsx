import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold">Picard</span>
            <AppNav items={NAV_BY_ROLE[role]} />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{who}</span>
            <form action={logoutAction}>
              <button type="submit" className="rounded px-2 py-1 hover:bg-slate-100">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
