import assert from "node:assert/strict";
import test from "node:test";
import { MAX_DELIVERY_ATTEMPTS, retryDelay } from "@/lib/notifications/dispatch";

test("retries wait 30s then 2 minutes, and stop after three attempts", () => {
  assert.equal(retryDelay(1), 30_000);
  assert.equal(retryDelay(2), 120_000);
  assert.equal(MAX_DELIVERY_ATTEMPTS, 3);
});
