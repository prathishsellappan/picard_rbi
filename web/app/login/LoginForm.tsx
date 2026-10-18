"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";
import { buttonClass, inputClass } from "@/components/ui";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-[14px]">
      <label className="block text-[13px]">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Login</span>
        <input name="login" autoComplete="username" required className={inputClass} placeholder="e.g. creator1" />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
          Password
        </span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state.error && (
        <p role="alert" className="text-[12px] text-flag-deep">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
