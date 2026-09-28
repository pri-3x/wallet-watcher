import type { ActivityEvent } from "@/lib/types";

export type Behavior = {
  hours: number[];
  mostActiveStart: number;
  average: number;
  largest: number;
  shares: Array<{ label: string; value: number }>;
  sampleSize: number;
};

export function computeBehavior(events: ActivityEvent[]): Behavior {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const event of events) {
    hours[new Date(event.timestamp).getUTCHours()] += 1;
  }

  let mostActiveStart = 0;
  let best = -1;
  for (let start = 0; start < 24; start += 1) {
    let sum = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      sum += hours[(start + offset) % 24] ?? 0;
    }
    if (sum > best) {
      best = sum;
      mostActiveStart = start;
    }
  }

  const priced = events.filter((event) => event.amountUsd > 0);
  const average = priced.length
    ? priced.reduce((sum, event) => sum + event.amountUsd, 0) / priced.length
    : 0;
  const largest = priced.reduce((max, event) => Math.max(max, event.amountUsd), 0);
  const total = events.length || 1;
  const dex = events.filter((event) => event.type === "swap").length;
  const exchange = events.filter(
    (event) =>
      event.type !== "swap" &&
      (event.from.kind === "exchange" || event.to.kind === "exchange"),
  ).length;
  const contracts = events.filter(
    (event) => event.type === "defi" || event.type === "nft" || event.type === "contract",
  ).length;

  return {
    hours,
    mostActiveStart,
    average,
    largest,
    shares: [
      { label: "DEX usage", value: dex / total },
      { label: "Exchange interaction", value: exchange / total },
      { label: "Contract interactions", value: contracts / total },
    ],
    sampleSize: events.length,
  };
}

export const SAMPLE_HOURS = [
  0, 0, 0, 0, 1, 0, 1, 1, 2, 8, 11, 9, 6, 3, 2, 1, 1, 2, 1, 0, 0, 1, 0, 0,
];
