import assert from "node:assert/strict";
import test from "node:test";
import { buildOverview, gini, placeHolders } from "./overview";

test("equal balances have a distribution score of zero", () => {
  assert.ok(gini([10, 10, 10, 10]) < 0.001);
});

test("one holder owning the supply scores near one", () => {
  const score = gini([100, 0.01, 0.01, 0.01]);
  assert.ok(score > 0.7);
});

test("concentration bands use supply, not just the fetched list", () => {
  const overview = buildOverview({
    address: "0xabc",
    chainId: "ethereum",
    name: "LCX",
    symbol: "LCX",
    price: 1,
    totalSupply: 100,
    holdersCount: 10,
    holders: [
      { address: "0x1", label: "A", amount: 50 },
      { address: "0x2", label: "B", amount: 20 },
      { address: "0x3", label: "C", amount: 10 },
    ],
    transfers: [{ from: "0x1", to: "0x2", amount: 4 }],
  });
  assert.ok(Math.abs(overview.top5 - 0.8) < 1e-9);
  assert.ok(Math.abs((overview.bands.at(-1)?.share ?? 0) - 0.2) < 1e-9);
  assert.equal(overview.flowEdges.length, 1);
  assert.equal(overview.whaleCount, 0);
});

test("a holder worth at least $100k is a whale", () => {
  const overview = buildOverview({
    address: "0xabc",
    chainId: "ethereum",
    name: "LCX",
    symbol: "LCX",
    price: 2,
    totalSupply: 100_000,
    holdersCount: 2,
    holders: [{ address: "0x1", label: "A", amount: 60_000 }],
    transfers: [],
  });
  assert.equal(overview.whaleCount, 1);
  assert.equal(overview.tiers[0]?.label, "Whale");
  assert.equal(overview.tiers[0]?.count, 1);
});

test("bubbles do not start on top of each other", () => {
  const placed = placeHolders([0.4, 0.2, 0.1, 0.05]);
  assert.equal(placed.length, 4);
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const gap = Math.hypot(placed[i]!.x - placed[j]!.x, placed[i]!.y - placed[j]!.y);
      assert.ok(gap >= placed[i]!.r + placed[j]!.r);
    }
  }
});
