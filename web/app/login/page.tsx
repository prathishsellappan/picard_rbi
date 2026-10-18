import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { homePathFor } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user));

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4">
      <div className="flex justify-end pt-4">
        <ThemeToggle />
      </div>
      <div className="fade-up mt-10">
        <p className="text-[15px] font-semibold tracking-tight text-green-deep">PICARD</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink">Role-play login</h1>
        <p className="mb-5 mt-0.5 text-[12px] text-ink-muted">Use the login and password from your card.</p>
        <LoginForm />
      </div>
    </main>
  );
}
