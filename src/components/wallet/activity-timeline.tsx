"use client";

import { useState } from "react";
import { shortAddress } from "@/lib/address";
import { formatAmount, formatUsd } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";
import { RelativeTime } from "@/components/ui/figures";

const FIRST = 12;
const STEP = 24;

export function ActivityTimeline({
  events,
  now,
  onSelect,
}: {
  events: ActivityEvent[];
  now: number;
  onSelect: (event: ActivityEvent) => void;
}) {
  const [count, setCount] = useState(FIRST);
  if (events.length === 0) return null;

  const visible = events.slice(0, count);
  const groups = groupByDay(visible, now);
  const remaining = events.length - visible.length;

  return (
    <section className="mt-20">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-3xl tracking-tight">Recent activity</h2>
        <p className="font-mono text-sm text-faint">
          {visible.length === events.length ? events.length : `${visible.length} of ${events.length}`}
        </p>
      </div>
      <ol className="border-t border-line">
        {groups.map((group) => (
          <li key={group.label}>
            <div className="flex items-baseline justify-between border-b border-line py-3">
              <p className="eyebrow">{group.label}</p>
              <p className="font-mono text-xs text-faint">{group.events.length}</p>
            </div>
            <ol>
              {group.events.map((event) => {
                const dot =
                  event.direction === "in" ? "bg-inflow" : event.type === "swap" ? "bg-brass" : "bg-outflow";
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(event)}
                      className="grid w-full gap-2 border-b border-line py-3 text-left hover:bg-wash md:grid-cols-[140px_1fr_auto] md:gap-8"
                    >
                      <div className="flex items-center gap-3 md:block">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
                        <div className="text-sm md:mt-2">
                          <RelativeTime timestamp={event.timestamp} now={now} />
                        </div>
                      </div>
                      <div>
                        <p className="tracking-tight">{event.summary}</p>
                        {event.type === "swap" && event.detail ? (
                          <p className="mt-1 text-sm text-muted">{event.detail}</p>
                        ) : (
                          <p className="mt-1 font-mono text-xs text-muted">
                            {shortAddress(event.from.address)}
                            <span className="mx-2 text-faint">↓</span>
                            {shortAddress(event.to.address)}
                          </p>
                        )}
                        {event.protocol ? <p className="mt-1 text-sm text-faint">{event.protocol}</p> : null}
                      </div>
                      <p className="font-mono text-sm md:text-right">
                        {event.amountUsd > 0 ? formatUsd(event.amountUsd) : formatAmount(event.amount)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setCount((current) => current + STEP)}
          className="mt-6 text-sm text-muted hover:text-ink"
        >
          Show {Math.min(STEP, remaining)} earlier
        </button>
      ) : null}
    </section>
  );
}

function groupByDay(events: ActivityEvent[], now: number) {
  const groups: Array<{ label: string; events: ActivityEvent[] }> = [];
  for (const event of events) {
    const label = dayLabel(event.timestamp, now);
    const last = groups.at(-1);
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}

function dayLabel(timestamp: number, now: number) {
  const day = utcDay(timestamp);
  if (day === utcDay(now)) return "Today";
  if (day === utcDay(now - 86_400_000)) return "Yesterday";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
