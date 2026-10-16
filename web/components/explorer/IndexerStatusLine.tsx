import type { IndexerStatus } from "@/lib/explorer";

export function IndexerStatusLine({ status }: { status: IndexerStatus }) {
  if (status.lastBlock === null) {
    return <p className="text-xs text-slate-500">The indexer hasn&apos;t run yet for this scenario.</p>;
  }
  const behind = status.headBlock !== null ? status.headBlock - status.lastBlock : null;
  return (
    <p className="text-xs text-slate-500">
      Indexed up to block {status.lastBlock}
      {status.headBlock !== null &&
        ` (chain head ${status.headBlock}${behind && behind > 0 ? `, ${behind} behind` : ""})`}
      . Lists come from this index; transaction pages are read live from the chain.
    </p>
  );
}
