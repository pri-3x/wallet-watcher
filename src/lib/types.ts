export type ActivityType = "transfer" | "swap" | "defi" | "nft" | "contract";

export type NodeKind = "focus" | "exchange" | "protocol" | "wallet" | "contract" | "cluster";

export type Direction = "in" | "out";

export type ActivityFilter = "all" | ActivityType;

export type Party = {
  address: string;
  label: string;
  kind: Exclude<NodeKind, "focus" | "cluster">;
};

export type ActivityEvent = {
  id: string;
  hash: string;
  timestamp: number;
  type: ActivityType;
  direction: Direction;
  asset: string;
  amount: string;
  amountUsd: number;
  from: Party;
  to: Party;
  counterAsset?: string;
  counterAmount?: string;
  blockNumber: number;
  gasEth: string;
  protocol?: string;
  summary: string;
  detail?: string;
};

export type Holding = {
  symbol: string;
  amount: string;
  usd: number;
};

export type WalletView = {
  address: string;
  chain: "ethereum";
  chainLabel: string;
  explorer: string;
  ensName?: string | null;
  source: "demo" | "live";
  balanceUsd: number;
  balanceEth: string;
  holdings: Holding[];
  txCount: number;
  firstSeen: number;
  lastActive: number;
  events: ActivityEvent[];
  note?: string | null;
  error?: {
    title: string;
    body: string;
    technical?: string;
  } | null;
};

export type SearchHit = {
  kind: "wallet" | "transaction" | "ens" | "token" | "protocol";
  title: string;
  subtitle: string;
  href: string;
};
