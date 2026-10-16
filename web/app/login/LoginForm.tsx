"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";
import { buttonClass, inputClass } from "@/components/ui";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Login</span>
        <input name="login" autoComplete="username" required className={inputClass} placeholder="e.g. creator1" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
