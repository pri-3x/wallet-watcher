export function formatUsd(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatUsdCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return formatUsd(value, abs < 100 ? 2 : 0);
}

export function formatAmount(amount: string | number) {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
  if (abs > 0 && abs < 0.01) {
    return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatRelative(timestamp: number, now: number) {
  const delta = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "just now";
  if (delta < hour) {
    const minutes = Math.round(delta / minute);
    return `${minutes} min ago`;
  }
  if (delta < day) {
    const hours = Math.round(delta / hour);
    return `${hours}h ago`;
  }
  if (delta < 30 * day) {
    const days = Math.round(delta / day);
    return `${days}d ago`;
  }
  return formatISODate(timestamp);
}

export function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
  return `${day} · ${time}`;
}

export function formatISODate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatWindow(start: number) {
  return `${formatHour(start)}–${formatHour((start + 4) % 24)}`;
}

const RANGE_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Infinity,
} as const;

export type TimeRange = keyof typeof RANGE_MS;

export function withinRange(timestamp: number, range: TimeRange, now: number) {
  return now - timestamp <= RANGE_MS[range];
}
