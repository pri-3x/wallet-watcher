import assert from "node:assert/strict";
import test from "node:test";
import { COOLDOWN_15_MIN, planDeliveries, QUIET_NOTE, HISTORY_NOTE } from "@/lib/alerts/quiet";

const now = 1_700_000_000_000;

test("the first live match sends and the rest of the window is logged", () => {
  const plan = planDeliveries(
    [
      { id: "b", timestamp: now - 1_000 },
      { id: "a", timestamp: now - 5_000 },
    ],
    { liveAfter: now - 60_000, cooldownMs: COOLDOWN_15_MIN, lastNotifiedAt: 0, now },
  );

  assert.deepEqual(
    plan.events.map((event) => ({ id: event.id, status: event.status, error: event.error })),
    [
      { id: "a", status: "pending", error: undefined },
      { id: "b", status: "logged", error: QUIET_NOTE },
    ],
  );
  assert.equal(plan.notified, true);
  assert.equal(plan.lastNotifiedAt, now);
});

test("a recent send keeps the whole batch quiet", () => {
  const plan = planDeliveries([{ id: "a", timestamp: now - 1_000 }], {
    liveAfter: 0,
    cooldownMs: COOLDOWN_15_MIN,
    lastNotifiedAt: now - 60_000,
    now,
  });

  assert.equal(plan.events[0]?.status, "logged");
  assert.equal(plan.events[0]?.error, QUIET_NOTE);
  assert.equal(plan.notified, false);
  assert.equal(plan.lastNotifiedAt, now - 60_000);
});

test("immediate delivery sends every live match", () => {
  const plan = planDeliveries(
    [
      { id: "a", timestamp: now - 2_000 },
      { id: "b", timestamp: now - 1_000 },
    ],
    { liveAfter: 0, cooldownMs: 0, lastNotifiedAt: now - 1_000, now },
  );

  assert.deepEqual(
    plan.events.map((event) => event.status),
    ["pending", "pending"],
  );
});

test("history is logged and does not start the quiet window", () => {
  const plan = planDeliveries(
    [
      { id: "old", timestamp: 1_000 },
      { id: "new", timestamp: now - 1_000 },
    ],
    { liveAfter: now - 60_000, cooldownMs: COOLDOWN_15_MIN, lastNotifiedAt: 0, now },
  );

  assert.equal(plan.events[0]?.error, HISTORY_NOTE);
  assert.equal(plan.events[1]?.status, "pending");
  assert.equal(plan.notified, true);
});

test("a match after the window sends again", () => {
  const plan = planDeliveries([{ id: "a", timestamp: now - 1_000 }], {
    liveAfter: 0,
    cooldownMs: COOLDOWN_15_MIN,
    lastNotifiedAt: now - COOLDOWN_15_MIN,
    now,
  });

  assert.equal(plan.events[0]?.status, "pending");
  assert.equal(plan.notified, true);
});
