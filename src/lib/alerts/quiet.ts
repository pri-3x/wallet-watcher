/** How long a watch stays silent after it sends. */
export const COOLDOWN_IMMEDIATE = 0;
export const COOLDOWN_15_MIN = 900_000;
export const COOLDOWN_1_HOUR = 3_600_000;
export const DEFAULT_COOLDOWN_MS = COOLDOWN_15_MIN;

export const COOLDOWN_OPTIONS = [
  { ms: COOLDOWN_IMMEDIATE, label: "Immediate" },
  { ms: COOLDOWN_15_MIN, label: "15 minutes" },
  { ms: COOLDOWN_1_HOUR, label: "1 hour" },
] as const;

export const HISTORY_NOTE = "Recorded from history. Not sent.";
export const QUIET_NOTE = "Within the quiet period. Not sent.";

export function isCooldownChoice(value: number) {
  return COOLDOWN_OPTIONS.some((option) => option.ms === value);
}

export function cooldownPhrase(ms: number) {
  if (ms <= 0) return "Sends every match";
  const option = COOLDOWN_OPTIONS.find((item) => item.ms === ms);
  return option ? `Quiet for ${option.label.toLowerCase()}` : "Quiet for 15 minutes";
}

/** True when a live match should be recorded and not delivered. */
export function isQuiet(lastNotifiedAt: number, cooldownMs: number, now: number) {
  return cooldownMs > 0 && lastNotifiedAt > 0 && now - lastNotifiedAt < cooldownMs;
}

export type DeliveryIntent = {
  status: "pending" | "logged";
  error?: string;
};

/**
 * Oldest live match sends. Later matches inside the quiet window are logged.
 * History never sends and never starts the window.
 */
export function planDeliveries<T extends { timestamp: number }>(
  events: T[],
  options: { liveAfter: number; cooldownMs: number; lastNotifiedAt: number; now: number },
): { events: Array<T & DeliveryIntent>; lastNotifiedAt: number; notified: boolean } {
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let lastNotifiedAt = options.lastNotifiedAt;
  let notified = false;

  const planned = ordered.map((event) => {
    const live = event.timestamp > options.liveAfter;
    if (!live) return { ...event, status: "logged" as const, error: HISTORY_NOTE };
    if (isQuiet(lastNotifiedAt, options.cooldownMs, options.now)) {
      return { ...event, status: "logged" as const, error: QUIET_NOTE };
    }
    lastNotifiedAt = options.now;
    notified = true;
    return { ...event, status: "pending" as const };
  });

  return { events: planned, lastNotifiedAt, notified };
}
