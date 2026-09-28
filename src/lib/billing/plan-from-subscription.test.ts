import assert from "node:assert/strict";
import test from "node:test";
import { planFromSubscription, type SubscriptionShape } from "@/lib/billing/plan-from-subscription";

const prices = (id: string) => (id === "price_desk" ? "desk" : id === "price_terminal" ? "terminal" : null);

function sub(overrides: Partial<SubscriptionShape> = {}): SubscriptionShape {
  return {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    customer: "cus_1",
    items: { data: [{ price: { id: "price_desk" }, current_period_end: 1_800_000_000 }] },
    ...overrides,
  };
}

test("an active subscription on a known price sets that plan", () => {
  const change = planFromSubscription(sub(), prices);
  assert.equal(change.plan, "desk");
  assert.deepEqual(change.billing, {
    customerId: "cus_1",
    subscriptionId: "sub_1",
    status: "active",
    periodEnd: 1_800_000_000_000,
    cancelAtPeriodEnd: false,
  });
});

test("the customer can arrive expanded", () => {
  const change = planFromSubscription(sub({ customer: { id: "cus_2" } }), prices);
  assert.equal(change.billing.customerId, "cus_2");
});

test("a scheduled cancellation keeps the plan until the period ends", () => {
  const change = planFromSubscription(sub({ cancel_at_period_end: true }), prices);
  assert.equal(change.plan, "desk");
  assert.equal(change.billing.cancelAtPeriodEnd, true);
  assert.equal(change.billing.periodEnd, 1_800_000_000_000);
});

test("past_due keeps access while the card is retried", () => {
  assert.equal(planFromSubscription(sub({ status: "past_due" }), prices).plan, "desk");
});

test("a canceled subscription drops to Observer and forgets the subscription", () => {
  const change = planFromSubscription(sub({ status: "canceled" }), prices);
  assert.equal(change.plan, "observer");
  assert.equal(change.billing.subscriptionId, null);
  assert.equal(change.billing.periodEnd, null);
  assert.equal(change.billing.customerId, "cus_1");
});

test("unpaid and incomplete_expired drop to Observer", () => {
  assert.equal(planFromSubscription(sub({ status: "unpaid" }), prices).plan, "observer");
  assert.equal(planFromSubscription(sub({ status: "incomplete_expired" }), prices).plan, "observer");
});

test("an unknown price never grants a paid plan", () => {
  const change = planFromSubscription(
    sub({ items: { data: [{ price: { id: "price_other" }, current_period_end: 1 }] } }),
    prices,
  );
  assert.equal(change.plan, "observer");
});
