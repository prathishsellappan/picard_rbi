import { formatEther } from "ethers";
import { explorerAddressUrl, getConfiguredChain } from "@/lib/chains";
import type { ProjectInfo } from "@/lib/contracts";
import { Mono } from "./ui";

// Confirmed on-chain values of a project, read from its contract at page load.
export function ProjectFacts({ project, showFunds }: { project: ProjectInfo; showFunds: boolean }) {
  const url = explorerAddressUrl(getConfiguredChain(), project.address);
  return (
    <dl className="space-y-1 text-sm">
      <Row label="Mint price">{formatEther(project.mintPriceWei)} ETH</Row>
      <Row label="NFTs minted">{project.mintedCount}</Row>
      {showFunds && (
        <>
          <Row label="Total received">{formatEther(project.totalReceivedWei)} ETH</Row>
          <Row label="Total withdrawn">{formatEther(project.totalWithdrawnWei)} ETH</Row>
          <Row label="Available">{formatEther(project.availableWei)} ETH</Row>
        </>
      )}
      <div className="pt-1">
        <dt className="text-slate-500">Contract</dt>
        <dd>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline">
              <Mono>{project.address}</Mono>
            </a>
          ) : (
            <Mono>{project.address}</Mono>
          )}
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
