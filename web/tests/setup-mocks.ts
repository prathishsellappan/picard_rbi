import { vi } from "vitest";

// Stand-ins for the Next.js request runtime so server code can run under Vitest.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", async () => {
  const { cookieStore } = await import("./helpers");
  return { cookies: async () => cookieStore };
});
vi.mock("next/navigation", async () => {
  const { RedirectError } = await import("./helpers");
  return {
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
