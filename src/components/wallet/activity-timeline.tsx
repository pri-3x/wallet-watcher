"use client";

import { shortAddress } from "@/lib/address";
import { formatAmount, formatUsd } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";
import { RelativeTime } from "@/components/ui/figures";

export function ActivityTimeline({
  events,
  now,
  onSelect,
}: {
  events: ActivityEvent[];
  now: number;
  onSelect: (event: ActivityEvent) => void;
}) {
  if (events.length === 0) return null;

  return (
    <section className="mt-20">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-3xl tracking-tight">Recent activity</h2>
        <p className="font-mono text-sm text-faint">{events.length}</p>
      </div>
      <ol className="border-t border-line">
        {events.map((event) => {
          const dot =
            event.direction === "in" ? "bg-inflow" : event.type === "swap" ? "bg-brass" : "bg-outflow";
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(event)}
                className="grid w-full gap-3 border-b border-line py-6 text-left hover:bg-wash md:grid-cols-[150px_1fr_auto] md:gap-8"
              >
                <div className="flex items-center gap-3 md:block">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
                  <div className="text-sm md:mt-3">
                    <RelativeTime timestamp={event.timestamp} now={now} />
                  </div>
                </div>
                <div>
                  <p className="text-lg tracking-tight">{event.summary}</p>
                  {event.type === "swap" && event.detail ? (
                    <p className="mt-2 text-sm text-muted">{event.detail}</p>
                  ) : (
                    <p className="mt-3 font-mono text-xs text-muted">
                      {shortAddress(event.from.address)}
                      <span className="mx-2 text-faint">↓</span>
                      {shortAddress(event.to.address)}
                    </p>
                  )}
                  {event.protocol ? <p className="mt-2 text-sm text-faint">{event.protocol}</p> : null}
                </div>
                <p className="font-mono text-sm md:text-right">
                  {event.amountUsd > 0 ? formatUsd(event.amountUsd) : formatAmount(event.amount)}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
