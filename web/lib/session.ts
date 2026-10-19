import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getServerConfig } from "./config";
import { query, queryOne } from "./db";
import type { ParticipantRole, SessionUser } from "./roles";

export const SESSION_COOKIE = "picard_session";

// Browsers only send "Secure" cookies over HTTPS. Production deployments behind HTTPS keep them
// secure (the default in production); a production build served over plain http — e.g. the Docker
// image on a LAN or a bare AWS IP — sets COOKIE_SECURE=false, or nobody could stay logged in.
function secureCookies(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type SessionTarget = { organizerId: number } | { scenarioId: number; participantId: string };

// Creates a DB session and sets the cookie. Only call from a Server Function or Route Handler.
export async function startSession(target: SessionTarget): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const { sessionTtlHours } = getServerConfig();
  const expiresAt = new Date(Date.now() + sessionTtlHours * 3600 * 1000);

  if ("organizerId" in target) {
    await query("INSERT INTO sessions (token_hash, organizer_id, expires_at) VALUES ($1, $2, $3)", [
      hashToken(token),
      target.organizerId,
      expiresAt,
    ]);
  } else {
    await query("INSERT INTO sessions (token_hash, scenario_id, participant_id, expires_at) VALUES ($1, $2, $3, $4)", [
      hashToken(token),
      target.scenarioId,
      target.participantId,
      expiresAt,
    ]);
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

type SessionRow = {
  organizer_id: number | null;
  username: string | null;
  scenario_id: number | null;
  participant_id: string | null;
  participant_username: string | null;
  display_name: string | null;
  role: ParticipantRole | null;
  wallet_address: string | null;
};

// Resolves the cookie to a user. Role and wallet always come from the database,
// never from anything the client sends.
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<SessionRow>(
    `SELECT s.organizer_id, o.username,
            s.scenario_id, s.participant_id, p.username AS participant_username, p.display_name, p.role, p.wallet_address
       FROM sessions s
       LEFT JOIN organizers o ON o.id = s.organizer_id
       LEFT JOIN participants p ON p.scenario_id = s.scenario_id AND p.id = s.participant_id
       LEFT JOIN scenarios sc ON sc.id = s.scenario_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND (s.organizer_id IS NOT NULL OR (sc.is_active AND sc.chain_id = $2))`,
    [hashToken(token), getServerConfig().chain.id],
  );
  if (!row) return null;

  if (row.organizer_id !== null && row.username !== null) {
    return { kind: "organizer", organizerId: row.organizer_id, username: row.username };
  }
  if (
    row.participant_id &&
    row.participant_username &&
    row.scenario_id !== null &&
    row.role &&
    row.wallet_address &&
    row.display_name
  ) {
    return {
      kind: "participant",
      scenarioId: row.scenario_id,
      participantId: row.participant_id,
      username: row.participant_username,
      displayName: row.display_name,
      role: row.role,
      walletAddress: row.wallet_address,
    };
  }
  return null;
}
