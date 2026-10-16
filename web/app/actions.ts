"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerConfig } from "@/lib/config";
import { queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { endSession, startSession } from "@/lib/session";

export type LoginState = { error: string | null };

const loginSchema = z.object({
  login: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

const INVALID = "Invalid login or password.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ login: formData.get("login"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your login and password." };
  const { login, password } = parsed.data;

  // Participants log in with their ID (e.g. P01) in the active scenario for the configured chain.
  const participant = await queryOne<{ scenario_id: number; id: string; password_hash: string }>(
    `SELECT p.scenario_id, p.id, p.password_hash
       FROM participants p JOIN scenarios s ON s.id = p.scenario_id
      WHERE s.is_active AND s.chain_id = $1 AND upper(p.id) = upper($2)`,
    [getServerConfig().chain.id, login],
  );
  if (participant) {
    if (!(await verifyPassword(password, participant.password_hash))) return { error: INVALID };
    await startSession({ scenarioId: participant.scenario_id, participantId: participant.id });
    redirect("/");
  }

  const organizer = await queryOne<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM organizers WHERE username = $1",
    [login],
  );
  if (organizer && (await verifyPassword(password, organizer.password_hash))) {
    await startSession({ organizerId: organizer.id });
    redirect("/");
  }
  return { error: INVALID };
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
