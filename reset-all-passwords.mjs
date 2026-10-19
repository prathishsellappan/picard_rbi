import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Client } = pg;
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return [
    "scrypt",
    16384,
    8,
    1,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

const db = new Client({
  connectionString: "postgres://postgres:picard_password@localhost:5432/picard",
});

try {
  await db.connect();
  await db.query("BEGIN");

  const participants = await db.query(
    "SELECT username FROM participants"
  );

  for (const row of participants.rows) {
    await db.query(
      "UPDATE participants SET password_hash = $1 WHERE username = $2",
      [await hashPassword(row.username), row.username]
    );
  }

  const organizers = await db.query(
    "SELECT username FROM organizers"
  );

  for (const row of organizers.rows) {
    await db.query(
      "UPDATE organizers SET password_hash = $1 WHERE username = $2",
      [await hashPassword(row.username), row.username]
    );
  }

  await db.query("COMMIT");

  console.log(`Updated ${participants.rowCount} participant passwords.`);
  console.log(`Updated ${organizers.rowCount} organizer passwords.`);
  console.log("Each account password now equals its username.");
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("Password reset failed:", error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
