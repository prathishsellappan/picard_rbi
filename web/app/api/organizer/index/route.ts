import { authErrorResponse, authorize } from "@/lib/auth";
import { getProvider } from "@/lib/chain";
import { getServerConfig } from "@/lib/config";
import { getScenarioForOrganizer } from "@/lib/data/organizer";
import { withClient } from "@/lib/db";
import { confirmationsFor, indexToHead } from "@/indexer/core";

// Organizer-only "Sync now": runs the indexer up to the chain head (bounded per request).
export async function POST() {
  try {
    await authorize(["organizer"]);
    const { chain } = getServerConfig();
    const scenario = await getScenarioForOrganizer(chain.id);
    if (!scenario) return Response.json({ error: "No active scenario" }, { status: 404 });
    const provider = await getProvider();
    const result = await withClient((client) =>
      indexToHead(client, provider, scenario.id, { confirmations: confirmationsFor(chain.id), maxRounds: 20 }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not deployed")) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
