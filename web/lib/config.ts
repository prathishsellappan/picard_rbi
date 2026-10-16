import "server-only";
import { z } from "zod";
import { getConfiguredChain, type SupportedChain } from "./chains";

export type ServerConfig = {
  chain: SupportedChain;
  rpcUrl: string;
  databaseUrl: string;
  sessionTtlHours: number;
};

const envSchema = z.object({
  RPC_URL: z.url({ protocol: /^https?$/ }),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),
});

let cached: ServerConfig | null = null;

// Validates environment once per process. Throws with a readable message on bad config.
export function getServerConfig(): ServerConfig {
  if (cached) return cached;

  const chain = getConfiguredChain();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid server environment:\n  ${problems.join("\n  ")}`);
  }

  cached = {
    chain,
    rpcUrl: parsed.data.RPC_URL,
    databaseUrl: parsed.data.DATABASE_URL,
    sessionTtlHours: parsed.data.SESSION_TTL_HOURS,
  };
  return cached;
}
