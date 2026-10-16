import { authErrorResponse, authorize } from "@/lib/auth";
import { getServerConfig } from "@/lib/config";
import { getScenarioForOrganizer, listParticipantsForOrganizer } from "@/lib/data/organizer";

// Organizer-only: includes private fields (instructions, malicious flag).
export async function GET() {
  try {
    await authorize(["organizer"]);
    const scenario = await getScenarioForOrganizer(getServerConfig().chain.id);
    if (!scenario) return Response.json({ error: "No active scenario" }, { status: 404 });
    return Response.json(await listParticipantsForOrganizer(scenario.id));
  } catch (error) {
    return authErrorResponse(error);
  }
}
