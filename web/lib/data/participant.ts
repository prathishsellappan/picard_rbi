import "server-only";
import { queryOne } from "../db";
import type { ParticipantUser } from "../roles";

// Participant-facing queries. These must never select is_malicious or organizer_notes.

export async function getOwnInstructions(user: ParticipantUser): Promise<string> {
  const row = await queryOne<{ instructions: string }>(
    "SELECT instructions FROM participant_private WHERE scenario_id = $1 AND participant_id = $2",
    [user.scenarioId, user.participantId],
  );
  return row?.instructions ?? "";
}
