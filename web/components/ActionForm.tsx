"use client";

import { useActionState, type ReactNode } from "react";

export type ActionResult = { ok: boolean; message: string } | null;

// Small wrapper: runs a Server Function and shows its result message.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {result && (
        <p role="status" className={`mt-2 text-[13px] ${result.ok ? "text-green-deep" : "text-flag-deep"}`}>
          {result.message}
        </p>
      )}
    </form>
  );
}
