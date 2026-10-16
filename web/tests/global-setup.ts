// Recreates the test database schema and applies migrations before the test run.
// Uses TEST_DATABASE_URL (default postgres://localhost:5432/picard_test) — never the dev database.
import { execFileSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/picard_test";
  if (!url.endsWith("_test")) throw new Error("Refusing to reset a database whose name doesn't end in _test");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();

  execFileSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "migrate.ts")], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
}
