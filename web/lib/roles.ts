// Role and session-user types plus the pure authorization rule. No server imports, so it is
// safe to share and easy to unit test.

export const PARTICIPANT_ROLES = ["creator", "investor", "mule"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
export type AppRole = ParticipantRole | "organizer";

export type ParticipantUser = {
  kind: "participant";
  scenarioId: number;
  participantId: string; // internal ID and neutral public label, e.g. P01
  username: string; // role-based login, e.g. creator1
  displayName: string;
  role: ParticipantRole;
  walletAddress: string;
};

export type OrganizerUser = {
  kind: "organizer";
  organizerId: number;
  username: string;
};

export type SessionUser = ParticipantUser | OrganizerUser;

export function roleOf(user: SessionUser): AppRole {
  return user.kind === "organizer" ? "organizer" : user.role;
}

export function isAllowed(user: SessionUser | null, allowed: readonly AppRole[]): boolean {
  return user !== null && allowed.includes(roleOf(user));
}

export function homePathFor(user: SessionUser): string {
  return `/${roleOf(user)}`;
}
