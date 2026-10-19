
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const username = process.argv[2];

if (!username) {
  console.error("Usage: node generate-hash.mjs <username>");
  process.exit(1);
}

const password = username;
const salt = randomBytes(16);

const hash = await scryptAsync(password, salt, 32, {
  N: 16384,
  r: 8,
  p: 1
});

console.log([
  "scrypt",
  16384,
  8,
  1,
  salt.toString("base64"),
  hash.toString("base64")
].join("$"));
