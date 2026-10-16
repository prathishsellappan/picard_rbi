// Copies contract ABIs from Hardhat artifacts into the web app (web/lib/abi/*.json).
//   npm run export-abis -w contracts   (after hardhat build)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTRACTS = ["ProjectFactory", "Project", "ScenarioNFT", "Marketplace"];
const root = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(root, "..", "web", "lib", "abi");

await mkdir(outDir, { recursive: true });
for (const name of CONTRACTS) {
  const artifact = JSON.parse(
    await readFile(path.join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`), "utf8"),
  );
  await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(artifact.abi, null, 2) + "\n");
  console.log(`wrote web/lib/abi/${name}.json`);
}
