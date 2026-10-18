"use client";

import { useEffect, useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

// Light/dark switch. The choice is stored in a cookie (a per-browser convenience) that the root
// layout reads on the server, so pages render in the chosen theme from the first paint.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Read the theme the server rendered (after hydration, so there is no mismatch).
    const current: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    queueMicrotask(() => setTheme(current));
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-line-strong bg-card-tint text-ink-muted hover:text-ink"
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
