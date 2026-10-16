import { Contract } from "ethers";
import { ABI } from "@/lib/abi";
import { getProvider } from "@/lib/chain";
import { ContractsNotReadyError, getNftToken, getScenarioContracts } from "@/lib/contracts";
import { getActiveScenario } from "@/lib/data/scenario";
import { queryOne } from "@/lib/db";

// Public ERC-721 metadata for ScenarioNFT tokenURI (base URI + token ID). Contains only public
// project information: the project name comes from its contract, the description from the app.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return Response.json({ error: "Invalid token ID" }, { status: 400 });

  try {
    const scenario = await getActiveScenario();
    if (!scenario) return Response.json({ error: "No active scenario" }, { status: 404 });
    const contracts = await getScenarioContracts(scenario.id);
    const token = await getNftToken(contracts, Number(id));
    if (!token) return Response.json({ error: "Token not found" }, { status: 404 });

    const project = new Contract(token.project, ABI.Project, await getProvider());
    const name = (await project.name()) as string;
    const row = await queryOne<{ description: string }>(
      "SELECT description FROM projects WHERE scenario_id = $1 AND lower(contract_address) = lower($2)",
      [scenario.id, token.project],
    );

    return Response.json({
      name: `${name} #${id}`,
      description: row?.description || `Role-play NFT for ${name}. Testnet asset with no monetary value.`,
      attributes: [
        { trait_type: "Project", value: name },
        { trait_type: "Project contract", value: token.project },
      ],
    });
  } catch (error) {
    if (error instanceof ContractsNotReadyError) return Response.json({ error: error.message }, { status: 404 });
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
