"use client";

import { useEffect, useState } from "react";
import { formatRelative, formatUsd } from "@/lib/format";

export function RelativeTime({ timestamp, now }: { timestamp: number; now: number }) {
  const [clock, setClock] = useState(now);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return <time dateTime={new Date(timestamp).toISOString()}>{formatRelative(timestamp, clock)}</time>;
}

export function Figure({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const from = shown;
    if (from === value) return;
    const started = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / 420);
      const eased = 1 - (1 - progress) ** 3;
      setShown(from + (value - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Animate only when the incoming value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className="tabular-nums">{formatUsd(shown)}</span>;
}
