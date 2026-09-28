// Next loads .env for the app. The worker runs outside Next, so it loads it here.
try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file. Rely on the process environment.
}

import Redis from "ioredis";
import { activeNetwork } from "@/lib/chains/ethereum";
import { indexWatches } from "@/lib/indexer";

const INTERVAL_MS = Math.max(10_000, Number(process.env.POLL_INTERVAL_MS) || 30_000);

async function withLock(fn: () => Promise<void>) {
  const url = process.env.REDIS_URL;
  if (!url) {
    await fn();
    return;
  }
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
  try {
    await redis.connect();
    const locked = await redis.set("walletwatch:index-lock", "1", "EX", 20, "NX");
    if (locked !== "OK") return;
    await fn();
  } catch (error) {
    console.error("Redis unavailable. Indexing without a lock.", error);
    await fn();
  } finally {
    redis.disconnect();
  }
}

async function loop() {
  const network = activeNetwork();
  console.log(`Wallet Watch worker · ${network.label} · every ${INTERVAL_MS / 1000}s`);
  for (;;) {
    const started = Date.now();
    try {
      await withLock(async () => {
        const report = await indexWatches({ notify: true });
        const took = Date.now() - started;
        console.log(
          `[${new Date().toISOString()}] ${report.watches} watches · ${report.recorded} recorded · ${report.queued} sent · ${report.skipped} skipped · ${took}ms`,
        );
      });
    } catch (error) {
      console.error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

void loop();
