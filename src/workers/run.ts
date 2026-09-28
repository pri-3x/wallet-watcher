// Next loads .env for the app. The worker runs outside Next, so it loads it here.
try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file. Rely on the process environment.
}

import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { activeNetwork } from "@/lib/chains/ethereum";
import { indexWatches } from "@/lib/indexer";
import {
  LOCK_REFRESH_MS,
  LOCK_TTL_MS,
  LockUnavailable,
  renewLock,
  withIndexLock,
  type LockClient,
} from "@/lib/worker/lock";

const INTERVAL_MS = Math.max(10_000, Number(process.env.POLL_INTERVAL_MS) || 30_000);
const token = randomUUID();

let redis: Redis | undefined;

function lockClient(): LockClient {
  const url = process.env.REDIS_URL;
  if (!url) throw new LockUnavailable("REDIS_URL is unset");
  if (!redis || redis.status === "end") {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  const client = redis;
  return {
    set: (key, value, mode, ttlMs, condition) => client.set(key, value, mode, ttlMs, condition),
    eval: (script, numKeys, ...args) => client.eval(script, numKeys, ...args.map(String)),
  };
}

async function connect(): Promise<LockClient> {
  const client = lockClient();
  if (redis && redis.status === "wait") {
    try {
      await redis.connect();
    } catch (error) {
      redis.disconnect();
      redis = undefined;
      throw new LockUnavailable(error);
    }
  }
  return client;
}

async function dropRedis() {
  redis?.disconnect();
  redis = undefined;
}

async function loop() {
  const network = activeNetwork();
  const locking = Boolean(process.env.REDIS_URL);
  console.log(
    `Wallet Watch worker · ${network.label} · every ${INTERVAL_MS / 1000}s · ${locking ? "lock on" : "lock off"}`,
  );
  if (!locking) {
    console.warn("REDIS_URL is unset. A second worker would send the same alerts.");
  }

  for (;;) {
    const started = Date.now();
    try {
      if (!process.env.REDIS_URL) {
        await runPass(started);
      } else {
        const client = await connect();
        const outcome = await withIndexLock(
          client,
          token,
          () => runPass(started, () => ownLock(client)),
          { ttlMs: LOCK_TTL_MS, refreshMs: LOCK_REFRESH_MS },
        );
        if (outcome.status === "busy") {
          console.log(`[${new Date().toISOString()}] another worker holds the lock · skipped`);
        }
      }
    } catch (error) {
      if (error instanceof LockUnavailable) {
        console.error("Redis unavailable. Skipping this pass.");
        await dropRedis();
      } else {
        console.error(error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

async function ownLock(client: LockClient) {
  try {
    return await renewLock(client, token);
  } catch {
    return false;
  }
}

async function runPass(started: number, stillOwner?: () => Promise<boolean>) {
  const report = await indexWatches({ notify: true, stillOwner });
  const took = Date.now() - started;
  console.log(
    `[${new Date().toISOString()}] ${report.watches} watches · ${report.recorded} recorded · ${report.queued} sent · ${report.skipped} skipped · ${took}ms`,
  );
}

void loop();
