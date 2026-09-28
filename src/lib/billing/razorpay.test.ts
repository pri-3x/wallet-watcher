import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { paiseFor, signaturesMatch } from "@/lib/billing/razorpay";

test("desk and terminal are above Razorpay's minimum of 100 paise", () => {
  assert.ok(paiseFor("desk") >= 100);
  assert.ok(paiseFor("terminal") > paiseFor("desk"));
});

test("a signature matches only the order and payment it was made for", () => {
  const secret = "test_secret";
  const sign = (order: string, payment: string) =>
    createHmac("sha256", secret).update(`${order}|${payment}`).digest("hex");

  const good = sign("order_1", "pay_1");
  assert.equal(signaturesMatch("order_1", "pay_1", good, secret), true);
  assert.equal(signaturesMatch("order_1", "pay_2", good, secret), false);
  assert.equal(signaturesMatch("order_2", "pay_1", good, secret), false);
  assert.equal(signaturesMatch("order_1", "pay_1", good, "other_secret"), false);
  assert.equal(signaturesMatch("order_1", "pay_1", "not-hex", secret), false);
  assert.equal(signaturesMatch("order_1", "pay_1", "", secret), false);
});
