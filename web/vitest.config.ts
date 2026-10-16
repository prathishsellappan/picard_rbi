import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-mocks.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
    env: {
      NEXT_PUBLIC_CHAIN_ID: "31337",
      RPC_URL: "http://127.0.0.1:8546", // throwaway node started by global-setup
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/picard_test",
      SESSION_TTL_HOURS: "1",
    },
  },
});
