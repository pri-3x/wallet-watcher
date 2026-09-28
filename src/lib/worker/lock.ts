export const INDEX_LOCK_KEY = "walletwatch:index-lock";

/** Freed on its own if the holder crashes and stops refreshing. */
export const LOCK_TTL_MS = 60_000;

/** Renew inside the TTL so a slow poll does not drop the lock. */
export const LOCK_REFRESH_MS = 20_000;

export class LockUnavailable extends Error {
  constructor(cause: unknown) {
    super("Redis lock unavailable");
    this.name = "LockUnavailable";
    this.cause = cause;
  }
}

export type LockClient = {
  set(key: string, value: string, expiryMode: "PX", ttlMs: number, condition: "NX"): Promise<"OK" | null>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
};

const RELEASE = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const RENEW = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

export async function acquireLock(client: LockClient, token: string, ttlMs = LOCK_TTL_MS): Promise<"acquired" | "busy"> {
  let result: "OK" | null;
  try {
    result = await client.set(INDEX_LOCK_KEY, token, "PX", ttlMs, "NX");
  } catch (error) {
    throw new LockUnavailable(error);
  }
  return result === "OK" ? "acquired" : "busy";
}

/** Extends the TTL when this token still owns the key. */
export async function renewLock(client: LockClient, token: string, ttlMs = LOCK_TTL_MS): Promise<boolean> {
  try {
    const result = await client.eval(RENEW, 1, INDEX_LOCK_KEY, token, String(ttlMs));
    return result === 1;
  } catch (error) {
    throw new LockUnavailable(error);
  }
}

/** Deletes the key only when this token still owns it. */
export async function releaseLock(client: LockClient, token: string): Promise<void> {
  try {
    await client.eval(RELEASE, 1, INDEX_LOCK_KEY, token);
  } catch (error) {
    throw new LockUnavailable(error);
  }
}

export async function withIndexLock<T>(
  client: LockClient,
  token: string,
  fn: () => Promise<T>,
  options?: { ttlMs?: number; refreshMs?: number },
): Promise<{ status: "busy" } | { status: "ran"; value: T }> {
  const ttlMs = options?.ttlMs ?? LOCK_TTL_MS;
  const refreshMs = options?.refreshMs ?? LOCK_REFRESH_MS;
  const acquired = await acquireLock(client, token, ttlMs);
  if (acquired === "busy") return { status: "busy" };

  const timer = setInterval(() => {
    void renewLock(client, token, ttlMs).catch(() => {
      // The next ownership check stops delivery. The TTL frees a dead holder.
    });
  }, refreshMs);
  timer.unref?.();

  try {
    const value = await fn();
    return { status: "ran", value };
  } finally {
    clearInterval(timer);
    try {
      await releaseLock(client, token);
    } catch {
      // A failed release still expires with the TTL.
    }
  }
}
