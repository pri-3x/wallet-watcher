import assert from "node:assert/strict";
import test from "node:test";
import { acquireLock, releaseLock, renewLock, withIndexLock, type LockClient } from "@/lib/worker/lock";

type Entry = { token: string; expiresAt: number };

function memoryRedis(clock: { now: number }): LockClient & { current(): Entry | null } {
  let entry: Entry | null = null;
  const live = () => {
    if (entry && entry.expiresAt <= clock.now) entry = null;
    return entry;
  };

  return {
    current: () => live(),
    async set(_key, value, _mode, ttlMs) {
      if (live()) return null;
      entry = { token: value, expiresAt: clock.now + ttlMs };
      return "OK";
    },
    async eval(script, _numKeys, _key, token, ttl) {
      const current = live();
      if (!current || current.token !== token) return 0;
      if (script.includes("del")) {
        entry = null;
        return 1;
      }
      current.expiresAt = clock.now + Number(ttl);
      return 1;
    },
  };
}

test("the second worker does not take a lock that is still held", async () => {
  const redis = memoryRedis({ now: 1_000 });
  assert.equal(await acquireLock(redis, "a", 500), "acquired");
  assert.equal(await acquireLock(redis, "b", 500), "busy");
});

test("a released lock can be taken by the next worker", async () => {
  const redis = memoryRedis({ now: 1_000 });
  assert.equal(await acquireLock(redis, "a", 500), "acquired");
  await releaseLock(redis, "a");
  assert.equal(await acquireLock(redis, "b", 500), "acquired");
});

test("a worker cannot release or renew a lock it does not own", async () => {
  const clock = { now: 1_000 };
  const redis = memoryRedis(clock);
  assert.equal(await acquireLock(redis, "a", 500), "acquired");
  await releaseLock(redis, "b");
  assert.equal(redis.current()?.token, "a");
  assert.equal(await renewLock(redis, "b", 500), false);
  assert.equal(await renewLock(redis, "a", 5_000), true);
  clock.now = 2_000;
  assert.equal(redis.current()?.token, "a");
});

test("an expired lock is free for the next worker", async () => {
  const clock = { now: 1_000 };
  const redis = memoryRedis(clock);
  assert.equal(await acquireLock(redis, "a", 500), "acquired");
  clock.now = 1_500;
  assert.equal(await acquireLock(redis, "b", 500), "acquired");
});

test("the locked section runs once and then frees the key", async () => {
  const redis = memoryRedis({ now: 1_000 });
  let ran = 0;
  const outcome = await withIndexLock(redis, "a", async () => {
    ran += 1;
    return "done";
  }, { ttlMs: 500, refreshMs: 60_000 });

  assert.deepEqual(outcome, { status: "ran", value: "done" });
  assert.equal(ran, 1);
  assert.equal(redis.current(), null);

  const skipped = await withIndexLock(redis, "a", async () => {
    ran += 1;
    return "again";
  }, { ttlMs: 500, refreshMs: 60_000 });
  assert.equal(skipped.status, "ran");

  await acquireLock(redis, "holder", 500);
  const busy = await withIndexLock(redis, "other", async () => {
    ran += 1;
    return "nope";
  }, { ttlMs: 500, refreshMs: 60_000 });
  assert.deepEqual(busy, { status: "busy" });
  assert.equal(ran, 2);
  assert.equal(redis.current()?.token, "holder");
});

test("a thrown pass still frees the lock", async () => {
  const redis = memoryRedis({ now: 1_000 });
  await assert.rejects(
    withIndexLock(redis, "a", async () => {
      throw new Error("index failed");
    }, { ttlMs: 500, refreshMs: 60_000 }),
    /index failed/,
  );
  assert.equal(redis.current(), null);
});
