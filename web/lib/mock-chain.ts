// Stage 2 placeholder data. Everything here is MOCK application data, not blockchain state.
// It is replaced by real contract reads and the indexer in Stages 4–6.

export type MockProject = {
  id: number;
  name: string;
  creatorLabel: string;
  description: string;
  mintPriceEth: string;
  mintedCount: number;
  totalReceivedEth: string;
};

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

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 1,
    name: "Aurora Pixels",
    creatorLabel: "P01",
    description: "Generative skyline art.",
    mintPriceEth: "0.01",
    mintedCount: 3,
    totalReceivedEth: "0.03",
  },
  {
    id: 2,
    name: "Tidepool DAO",
    creatorLabel: "P02",
    description: "Community ocean-cleanup badges.",
    mintPriceEth: "0.015",
    mintedCount: 2,
    totalReceivedEth: "0.03",
  },
  {
    id: 3,
    name: "Neon Ledger",
    creatorLabel: "P03",
    description: "Cyberpunk collectible cards.",
    mintPriceEth: "0.02",
    mintedCount: 4,
    totalReceivedEth: "0.08",
  },
];

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
