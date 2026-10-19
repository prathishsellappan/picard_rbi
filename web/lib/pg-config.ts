// Postgres connection settings shared by the web app and the organizer scripts.
//
// Hosted Postgres such as Supabase signs its certificates with its own root CA, which is not in the
// public trust store, so the `pg` library's full verification (what `sslmode=require` means to it)
// fails with "self-signed certificate in certificate chain". Setting DATABASE_SSL_CA to the
// provider's CA certificate (PEM text; "\n" escapes allowed, for env-var UIs) keeps the connection
// encrypted AND verified. Local Postgres needs none of this.
import type { ClientConfig } from "pg";

export function pgConfig(connectionString: string | undefined): ClientConfig {
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (!connectionString || !ca) return { connectionString };

  // pg lets SSL settings in the URL override the config object, so drop them and pass ours.
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
