import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import {
  isAllowed,
  type AppRole,
  type OrganizerUser,
  type ParticipantRole,
  type ParticipantUser,
  type SessionUser,
} from "./roles";

// --- Pages (Server Components): redirect on failure ---

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireParticipant(role: ParticipantRole): Promise<ParticipantUser> {
  const user = await requireUser();
  if (user.kind !== "participant" || user.role !== role) redirect("/");
  return user;
}

export async function requireOrganizer(): Promise<OrganizerUser> {
  const user = await requireUser();
  if (user.kind !== "organizer") redirect("/");
  return user;
}

// --- Route Handlers and Server Functions: return an error instead of redirecting ---

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Not logged in" : "Not allowed for your role");
  }
}

export async function authorize(allowed: readonly AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401);
  if (!isAllowed(user, allowed)) throw new AuthError(403);
  return user;
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
