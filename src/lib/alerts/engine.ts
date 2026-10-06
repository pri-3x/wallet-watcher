import { isNativeAsset } from "@/lib/chains/catalog";
import { formatUsd } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

export type RuleType = "ANY" | "TRANSFER" | "ETH" | "STABLECOIN" | "DEX" | "NEW_CONTRACT";

export type AlertRule = {
  id: string;
  eventType: RuleType;
  asset?: string | null;
  threshold?: number | null;
  direction?: "INCOMING" | "OUTGOING" | "ANY" | null;
  enabled: boolean;
};

export type AlertMatch = {
  rule: AlertRule;
  event: ActivityEvent;
  summary: string;
  detail: string;
};

const STABLES = new Set(["USDC", "USDT", "DAI", "USDS", "USDE"]);
const PRIORITY: RuleType[] = ["TRANSFER", "NEW_CONTRACT", "DEX", "STABLECOIN", "ETH", "ANY"];

export function evaluateAlerts(rules: AlertRule[], events: ActivityEvent[]): AlertMatch[] {
  const enabled = rules.filter((rule) => rule.enabled);
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const knownContracts = new Set<string>();
  const best = new Map<string, AlertMatch>();

  for (const event of ordered) {
    const contractAddress = event.to.address.toLowerCase();
    const isNewContract =
      (event.type === "contract" || event.type === "defi") && !knownContracts.has(contractAddress);

    for (const rule of enabled) {
      if (!matches(rule, event, isNewContract)) continue;
      const match: AlertMatch = {
        rule,
        event,
        summary: ruleLabel(rule),
        detail: event.summary,
      };
      const current = best.get(event.hash);
      if (!current || rank(match.rule.eventType) < rank(current.rule.eventType)) {
        best.set(event.hash, match);
      }
    }

    if (event.type === "contract" || event.type === "defi" || event.type === "nft") {
      knownContracts.add(contractAddress);
    }
  }

  return [...best.values()].sort((a, b) => b.event.timestamp - a.event.timestamp);
}

function matches(rule: AlertRule, event: ActivityEvent, isNewContract: boolean) {
  switch (rule.eventType) {
    case "ANY":
      return true;
    case "TRANSFER": {
      if (event.type !== "transfer") return false;
      if (!directionOk(rule.direction, event.direction)) return false;
      if (rule.asset && rule.asset !== event.asset) return false;
      if (rule.threshold != null && event.amountUsd < rule.threshold) return false;
      return true;
    }
    case "ETH":
      return isNativeAsset(event.asset) || isNativeAsset(event.counterAsset ?? "");
    case "STABLECOIN":
      return STABLES.has(event.asset.toUpperCase()) || STABLES.has((event.counterAsset ?? "").toUpperCase());
    case "DEX":
      return event.type === "swap";
    case "NEW_CONTRACT":
      return isNewContract;
    default:
      return false;
  }
}

function directionOk(expected: AlertRule["direction"], actual: ActivityEvent["direction"]) {
  if (!expected || expected === "ANY") return true;
  if (expected === "INCOMING") return actual === "in";
  return actual === "out";
}

function rank(type: RuleType) {
  const index = PRIORITY.indexOf(type);
  return index === -1 ? PRIORITY.length : index;
}

export function ruleLabel(rule: Pick<AlertRule, "eventType" | "threshold">) {
  switch (rule.eventType) {
    case "TRANSFER":
      return rule.threshold ? `Transfer over ${formatUsd(rule.threshold)}` : "Transfer";
    case "ETH":
      return "ETH moved";
    case "STABLECOIN":
      return "Stablecoin moved";
    case "DEX":
      return "DEX interaction";
    case "NEW_CONTRACT":
      return "New contract";
    default:
      return "Transaction";
  }
}
