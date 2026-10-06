export type HolderRow = {
  address: string;
  label: string;
  amount: number;
  usd: number;
  share: number;
};

export type ShareBand = {
  label: string;
  share: number;
};

export type TierRow = {
  label: string;
  count: number;
  holderShare: number;
  capShare: number;
};

export type DepthRow = {
  label: string;
  minUsd: number;
  count: number;
};

export type FlowEdge = {
  from: string;
  to: string;
  amount: number;
  usd: number;
};

export type TokenOverview = {
  address: string;
  chainId: string;
  name: string;
  symbol: string;
  price: number;
  holdersCount: number;
  marketCap: number;
  top5: number;
  top10: number;
  top100: number;
  whaleShare: number;
  whaleCount: number;
  whaleHolderShare: number;
  gini: number;
  atLeastOnePercent: number;
  bands: ShareBand[];
  tiers: TierRow[];
  depth: DepthRow[];
  holders: HolderRow[];
  flowHolders: HolderRow[];
  flowEdges: FlowEdge[];
};

const TIER_FLOORS = [
  { label: "Whale", min: 100_000 },
  { label: "Shark", min: 10_000 },
  { label: "Dolphin", min: 1_000 },
  { label: "Fish", min: 100 },
  { label: "Crab", min: 10 },
  { label: "Shrimp", min: 0 },
] as const;

const DEPTH = [10, 50, 100, 250, 500, 1_000, 10_000, 100_000, 1_000_000];

export function gini(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const count = sorted.length;
  if (count === 0) return 0;
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  let weighted = 0;
  for (let index = 0; index < count; index += 1) weighted += (index + 1) * sorted[index]!;
  const score = (2 * weighted) / (count * total) - (count + 1) / count;
  return Math.min(1, Math.max(0, score));
}

export function buildOverview(input: {
  address: string;
  chainId: string;
  name: string;
  symbol: string;
  price: number;
  totalSupply: number;
  holdersCount: number;
  holders: Array<{ address: string; label: string; amount: number }>;
  transfers: Array<{ from: string; to: string; amount: number }>;
}): TokenOverview {
  const supply = input.totalSupply > 0 ? input.totalSupply : input.holders.reduce((sum, holder) => sum + holder.amount, 0);
  const price = input.price > 0 ? input.price : 0;
  const ranked = [...input.holders].sort((a, b) => b.amount - a.amount);
  const rows: HolderRow[] = ranked.map((holder) => ({
    address: holder.address,
    label: holder.label,
    amount: holder.amount,
    usd: holder.amount * price,
    share: supply > 0 ? holder.amount / supply : 0,
  }));

  const shareOf = (start: number, end: number) =>
    rows.slice(start, end).reduce((sum, holder) => sum + holder.share, 0);
  const top100Share = shareOf(0, 100);
  const bands: ShareBand[] = [
    { label: "Top 5", share: shareOf(0, 5) },
    { label: "6–10", share: shareOf(5, 10) },
    { label: "11–25", share: shareOf(10, 25) },
    { label: "26–50", share: shareOf(25, 50) },
    { label: "51–100", share: shareOf(50, 100) },
    { label: "Outside 100", share: Math.max(0, 1 - top100Share) },
  ];

  const whales = rows.filter((holder) => holder.usd >= 100_000);
  const holdersCount = Math.max(input.holdersCount, rows.length);
  const fetchedAmount = rows.reduce((sum, holder) => sum + holder.amount, 0);
  const remainder = Math.max(0, supply - fetchedAmount);
  const restCount = Math.max(0, holdersCount - rows.length);
  const restEach = restCount > 0 ? remainder / restCount : 0;
  const giniValues = [...rows.map((holder) => holder.amount), ...Array.from({ length: restCount }, () => restEach)];

  const tiers: TierRow[] = TIER_FLOORS.map((tier, index) => {
    const ceiling = TIER_FLOORS[index - 1]?.min ?? Number.POSITIVE_INFINITY;
    const members = rows.filter((holder) => holder.usd >= tier.min && holder.usd < ceiling);
    return {
      label: tier.label,
      count: members.length,
      holderShare: holdersCount > 0 ? members.length / holdersCount : 0,
      capShare: members.reduce((sum, holder) => sum + holder.share, 0),
    };
  });
  if (restCount > 0) {
    tiers.push({
      label: "Outside top 100",
      count: restCount,
      holderShare: holdersCount > 0 ? restCount / holdersCount : 0,
      capShare: supply > 0 ? remainder / supply : 0,
    });
  }

  const depth: DepthRow[] = DEPTH.map((minUsd) => ({
    label: minUsd >= 1000 ? `> $${minUsd / 1000}k`.replace("> $1000k", "> $1M") : `> $${minUsd}`,
    minUsd,
    count: rows.filter((holder) => holder.usd >= minUsd).length,
  })).map((row) => (row.minUsd === 1_000_000 ? { ...row, label: "> $1M" } : row));

  const flowHolders = rows.slice(0, 18);
  const known = new Set(flowHolders.map((holder) => holder.address.toLowerCase()));
  const edgeTotals = new Map<string, number>();
  for (const transfer of input.transfers) {
    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    if (!known.has(from) || !known.has(to) || from === to) continue;
    const key = `${from}>${to}`;
    edgeTotals.set(key, (edgeTotals.get(key) ?? 0) + transfer.amount);
  }
  const flowEdges: FlowEdge[] = [...edgeTotals.entries()].map(([key, amount]) => {
    const [from, to] = key.split(">");
    return { from: from ?? "", to: to ?? "", amount, usd: amount * price };
  });

  return {
    address: input.address,
    chainId: input.chainId,
    name: input.name,
    symbol: input.symbol,
    price,
    holdersCount,
    marketCap: supply * price,
    top5: shareOf(0, 5),
    top10: shareOf(0, 10),
    top100: top100Share,
    whaleShare: whales.reduce((sum, holder) => sum + holder.share, 0),
    whaleCount: whales.length,
    whaleHolderShare: holdersCount > 0 ? whales.length / holdersCount : 0,
    gini: gini(giniValues),
    atLeastOnePercent: rows.filter((holder) => holder.share >= 0.01).length,
    bands,
    tiers,
    depth,
    holders: rows.slice(0, 25),
    flowHolders,
    flowEdges,
  };
}

export function placeHolders(shares: number[]) {
  const placed: Array<{ x: number; y: number; r: number }> = [];
  for (let index = 0; index < shares.length; index += 1) {
    const radius = 16 + Math.sqrt(Math.max(shares[index] ?? 0, 0)) * 150;
    if (index === 0) {
      placed.push({ x: 320, y: 210, r: radius });
      continue;
    }
    let x = 320;
    let y = 210;
    for (let step = 0; step < 120; step += 1) {
      const angle = step * 0.62;
      const dist = 24 + step * 7;
      x = 320 + Math.cos(angle) * dist;
      y = 210 + Math.sin(angle) * dist;
      const overlaps = placed.some((node) => Math.hypot(node.x - x, node.y - y) < node.r + radius + 8);
      if (!overlaps) break;
    }
    placed.push({ x, y, r: radius });
  }
  if (placed.length === 0) return placed;
  const minX = Math.min(...placed.map((node) => node.x - node.r));
  const maxX = Math.max(...placed.map((node) => node.x + node.r));
  const minY = Math.min(...placed.map((node) => node.y - node.r));
  const maxY = Math.max(...placed.map((node) => node.y + node.r));
  const scale = Math.min(600 / Math.max(maxX - minX, 1), 380 / Math.max(maxY - minY, 1), 1);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return placed.map((node) => ({
    x: 320 + (node.x - centerX) * scale,
    y: 210 + (node.y - centerY) * scale,
    r: node.r * scale,
  }));
}
