// Contract ABIs exported from the Hardhat build (npm run export-abis -w contracts).
// Shared by server reads and browser transactions.
import type { InterfaceAbi } from "ethers";
import MarketplaceAbi from "./Marketplace.json";
import ProjectAbi from "./Project.json";
import ProjectFactoryAbi from "./ProjectFactory.json";
import ScenarioNFTAbi from "./ScenarioNFT.json";

export const ABI = {
  ProjectFactory: ProjectFactoryAbi as InterfaceAbi,
  Project: ProjectAbi as InterfaceAbi,
  Marketplace: MarketplaceAbi as InterfaceAbi,
  ScenarioNFT: ScenarioNFTAbi as InterfaceAbi,
};
