import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { cookieJar, RedirectError } from "./helpers";

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

const { loginAction, logoutAction } = await import("@/app/actions");
const { requireParticipant, requireOrganizer } = await import("@/lib/auth");
const { getSessionUser, SESSION_COOKIE } = await import("@/lib/session");
const { hashPassword } = await import("@/lib/password");
const { GET: getMe } = await import("@/app/api/me/route");
const { GET: getOrgParticipants } = await import("@/app/api/organizer/participants/route");
const { updateParticipantAction } = await import("@/app/(app)/organizer/actions");
const { getOwnInstructions } = await import("@/lib/data/participant");

const CREATOR_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const INVESTOR_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function login(loginId: string, password: string) {
  try {
    return await loginAction({ error: null }, form({ login: loginId, password }));
  } catch (error) {
    if (error instanceof RedirectError) return { redirected: error.url };
    throw error;
  }
}

beforeAll(async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const scenario = await db.query<{ id: number }>(
    "INSERT INTO scenarios (name, chain_id, is_active) VALUES ('test', 31337, TRUE) RETURNING id",
  );
  const sid = scenario.rows[0].id;
  const pw = await hashPassword("pw-participant");
  await db.query(
    `INSERT INTO participants (id, scenario_id, display_name, role, wallet_address, password_hash)
     VALUES ('P01', $1, 'Creator One', 'creator', $2, $4), ('P06', $1, 'Investor Six', 'investor', $3, $4)`,
    [sid, CREATOR_WALLET, INVESTOR_WALLET, pw],
  );
  await db.query(
    `INSERT INTO participant_private (scenario_id, participant_id, instructions, is_malicious, organizer_notes)
     VALUES ($1, 'P01', 'secret creator brief', TRUE, 'organizer eyes only'),
            ($1, 'P06', 'investor brief', FALSE, '')`,
    [sid],
  );
  await db.query("INSERT INTO organizers (username, password_hash) VALUES ('organizer', $1)", [
    await hashPassword("pw-organizer"),
  ]);
  await db.end();
});

beforeEach(() => cookieJar.clear());

describe("login", () => {
  it("logs a participant in by ID (case-insensitive) and redirects", async () => {
    expect(await login("p06", "pw-participant")).toEqual({ redirected: "/" });
    expect(cookieJar.get(SESSION_COOKIE)).toBeTruthy();
    const user = await getSessionUser();
    expect(user).toMatchObject({ kind: "participant", participantId: "P06", role: "investor" });
  });

  it("rejects a wrong password without setting a cookie", async () => {
    expect(await login("P06", "nope")).toEqual({ error: "Invalid login or password." });
    expect(cookieJar.size).toBe(0);
  });

  it("rejects unknown logins with the same message", async () => {
    expect(await login("P99", "pw-participant")).toEqual({ error: "Invalid login or password." });
  });

  it("logs out and invalidates the session server-side", async () => {
    await login("P06", "pw-participant");
    const token = cookieJar.get(SESSION_COOKIE)!;
    await expect(logoutAction()).rejects.toBeInstanceOf(RedirectError);
    cookieJar.set(SESSION_COOKIE, token); // replaying the old token must not work
    expect(await getSessionUser()).toBeNull();
  });

  it("ignores a forged session cookie", async () => {
    cookieJar.set(SESSION_COOKIE, "forged-token");
    expect(await getSessionUser()).toBeNull();
  });
});

describe("page guards", () => {
  it("redirects anonymous users to /login", async () => {
    await expect(requireParticipant("creator")).rejects.toMatchObject({ url: "/login" });
  });

  it("keeps an investor out of creator and organizer pages", async () => {
    await login("P06", "pw-participant");
    await expect(requireParticipant("creator")).rejects.toMatchObject({ url: "/" });
    await expect(requireOrganizer()).rejects.toMatchObject({ url: "/" });
    await expect(requireParticipant("investor")).resolves.toMatchObject({ participantId: "P06" });
  });
});

describe("API authorization", () => {
  it("returns 401 to anonymous callers", async () => {
    expect((await getMe()).status).toBe(401);
    expect((await getOrgParticipants()).status).toBe(401);
  });

  it("returns 403 when a participant calls an organizer endpoint", async () => {
    await login("P01", "pw-participant");
    expect((await getOrgParticipants()).status).toBe(403);
  });

  it("returns the participant's own profile without private scenario fields", async () => {
    await login("P01", "pw-participant");
    const body = await (await getMe()).json();
    expect(body).toMatchObject({ participantId: "P01", role: "creator", walletAddress: CREATOR_WALLET });
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/malicious|organizer_notes|secret creator brief/i);
  });

  it("gives the organizer the private fields", async () => {
    await login("organizer", "pw-organizer");
    const res = await getOrgParticipants();
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows.find((r: { id: string }) => r.id === "P01")).toMatchObject({ is_malicious: true });
  });

  it("refuses organizer Server Functions for participants", async () => {
    await login("P06", "pw-participant");
    const result = await updateParticipantAction(
      null,
      form({ id: "P06", displayName: "hacked", role: "creator", walletAddress: INVESTOR_WALLET }),
    );
    expect(result).toEqual({ ok: false, message: "Not allowed for your role" });
    await login("P06", "pw-participant");
    expect(await getSessionUser()).toMatchObject({ role: "investor" });
  });

  it("validates organizer input", async () => {
    await login("organizer", "pw-organizer");
    const bad = await updateParticipantAction(
      null,
      form({ id: "P06", displayName: "x", role: "investor", walletAddress: "0x123", isMalicious: "on" }),
    );
    expect(bad?.ok).toBe(false);
    const notCreator = await updateParticipantAction(
      null,
      form({ id: "P06", displayName: "x", role: "investor", walletAddress: INVESTOR_WALLET, isMalicious: "on" }),
    );
    expect(notCreator).toEqual({ ok: false, message: "Only a creator can be marked malicious." });
  });
});

describe("participant data", () => {
  it("returns only the participant's own instructions", async () => {
    await login("P06", "pw-participant");
    const user = await requireParticipant("investor");
    expect(await getOwnInstructions(user)).toBe("investor brief");
  });
});
