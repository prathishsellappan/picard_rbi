// Applies db/migrations/*.sql in filename order, once each.
// Usage: npm run db:migrate   (reads DATABASE_URL from web/.env.local)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { pgConfig } from "../lib/pg-config.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy web/.env.example to web/.env.local first.");
  process.exit(1);
}

const migrationsDir = path.join(import.meta.dirname, "..", "db", "migrations");
const client = new pg.Client(pgConfig(databaseUrl));
await client.connect();

try {
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
  );
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}
