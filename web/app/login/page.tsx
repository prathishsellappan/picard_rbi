import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user));

  return (
    <main className="mx-auto mt-16 w-full max-w-sm px-4">
      <h1 className="mb-1 text-2xl font-semibold">Role-play login</h1>
      <p className="mb-6 text-sm text-slate-600">Use the login and password from your card.</p>
      <LoginForm />
    </main>
  );
}
