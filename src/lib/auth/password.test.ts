import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

test("the same password verifies against its hash", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", stored), true);
});

test("a different password does not verify", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse batter", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("two hashes of the same password differ by salt", async () => {
  const a = await hashPassword("same");
  const b = await hashPassword("same");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same", a), true);
  assert.equal(await verifyPassword("same", b), true);
});

test("a malformed stored value never verifies", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", "plaintext"), false);
  assert.equal(await verifyPassword("anything", "bcrypt$1$2$3$abc$def"), false);
});
