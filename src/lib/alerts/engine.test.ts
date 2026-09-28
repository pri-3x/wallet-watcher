import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAlerts, type AlertRule } from "./engine";
import type { ActivityEvent } from "../types";

const wallet = { address: "0x1111111111111111111111111111111111111111", label: "Wallet", kind: "wallet" as const };
const other = { address: "0x2222222222222222222222222222222222222222", label: "Other", kind: "wallet" as const };
const uni = { address: "0x3333333333333333333333333333333333333333", label: "Uniswap", kind: "protocol" as const };
const contract = { address: "0x4444444444444444444444444444444444444444", label: "Contract", kind: "contract" as const };

function event(overrides: Partial<ActivityEvent> & Pick<ActivityEvent, "hash" | "type" | "asset" | "amountUsd">): ActivityEvent {
  return {
    id: overrides.hash,
    timestamp: 1,
    direction: "out",
    amount: "1",
    from: wallet,
    to: other,
    blockNumber: 1,
    gasEth: "0.0001",
    summary: "Moved",
    ...overrides,
  };
}

const rules: AlertRule[] = [
  { id: "any", eventType: "ANY", enabled: true },
  { id: "transfer", eventType: "TRANSFER", threshold: 10000, direction: "OUTGOING", enabled: true },
  { id: "eth", eventType: "ETH", enabled: true },
  { id: "stable", eventType: "STABLECOIN", enabled: true },
  { id: "dex", eventType: "DEX", enabled: true },
  { id: "new", eventType: "NEW_CONTRACT", enabled: true },
];

test("a large outgoing transfer prefers the threshold rule", () => {
  const matches = evaluateAlerts(rules, [
    event({
      hash: "0xaaa",
      type: "transfer",
      asset: "USDC",
      amountUsd: 12400,
      summary: "Sent 12,400 USDC",
    }),
  ]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.rule.eventType, "TRANSFER");
});

test("swaps match the DEX rule and ignore the transfer threshold", () => {
  const matches = evaluateAlerts(rules, [
    event({
      hash: "0xbbb",
      type: "swap",
      asset: "ETH",
      amountUsd: 13842,
      to: uni,
    }),
  ]);
  assert.equal(matches[0]?.rule.eventType, "DEX");
});

test("a contract is new only the first time it appears", () => {
  const matches = evaluateAlerts(rules, [
    event({ hash: "0x1", type: "contract", asset: "ETH", amountUsd: 0, to: contract, timestamp: 1 }),
    event({ hash: "0x2", type: "contract", asset: "ETH", amountUsd: 0, to: contract, timestamp: 2 }),
  ]);
  const novel = matches.find((match) => match.rule.eventType === "NEW_CONTRACT");
  assert.equal(novel?.event.hash, "0x1");
  assert.equal(matches.filter((match) => match.event.hash === "0x2" && match.rule.eventType === "NEW_CONTRACT").length, 0);
});

test("disabled rules are ignored", () => {
  const matches = evaluateAlerts(
    [{ id: "any", eventType: "ANY", enabled: false }],
    [event({ hash: "0xccc", type: "transfer", asset: "ETH", amountUsd: 10 })],
  );
  assert.equal(matches.length, 0);
});
