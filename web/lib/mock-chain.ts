// Stage 2 placeholder data. Everything here is MOCK application data, not blockchain state.
// Only the explorer still uses it; the indexer replaces it in Stage 6.

export type MockTx = {
  hash: string;
  blockNumber: number;
  timestamp: string;
  fromLabel: string;
  toLabel: string;
  valueEth: string;
  kind: string;
  status: "pending" | "confirmed" | "failed";
};

export const MOCK_TXS: MockTx[] = [
  {
    hash: "0xmock01",
    blockNumber: 101,
    timestamp: "2026-10-16T10:00:00Z",
    fromLabel: "Exchange 1",
    toLabel: "P06",
    valueEth: "0.05",
    kind: "Transfer",
    status: "confirmed",
  },
  {
    hash: "0xmock02",
    blockNumber: 104,
    timestamp: "2026-10-16T10:02:00Z",
    fromLabel: "P01",
    toLabel: "ProjectFactory",
    valueEth: "0",
    kind: "createProject",
    status: "confirmed",
  },
  {
    hash: "0xmock03",
    blockNumber: 110,
    timestamp: "2026-10-16T10:05:00Z",
    fromLabel: "P06",
    toLabel: "Marketplace",
    valueEth: "0.01",
    kind: "mint",
    status: "confirmed",
  },
  {
    hash: "0xmock04",
    blockNumber: 112,
    timestamp: "2026-10-16T10:06:00Z",
    fromLabel: "P07",
    toLabel: "Marketplace",
    valueEth: "0.015",
    kind: "mint",
    status: "pending",
  },
];
