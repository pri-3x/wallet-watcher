import { computeBehavior } from "@/lib/behavior";
import { formatUsd, formatWindow } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";
import { ActivityClock } from "@/components/wallet/activity-clock";
import { Figure } from "@/components/ui/figures";

export function BehaviorSection({ events }: { events: ActivityEvent[] }) {
  const behavior = computeBehavior(events);
  if (behavior.sampleSize === 0) return null;

  return (
    <section className="mt-20 border-t border-line pt-12">
      <h2 className="text-3xl tracking-tight">Behavior</h2>
      <p className="mt-3 text-sm text-faint">Measured from the activity in view. Hours are UTC.</p>
      <div className="mt-10 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="eyebrow">Activity pattern</p>
          <ActivityClock hours={behavior.hours} start={behavior.mostActiveStart} />
        </div>
        <div className="md:col-span-6">
          <dl>
            <div className="border-t border-line py-4">
              <dt className="eyebrow">Most active</dt>
              <dd className="mt-2 font-mono text-2xl">{formatWindow(behavior.mostActiveStart)}</dd>
            </div>
            <div className="border-t border-line py-4">
              <dt className="eyebrow">Average transaction</dt>
              <dd className="mt-2 text-2xl">
                <Figure value={behavior.average} />
              </dd>
            </div>
            <div className="border-t border-line py-4">
              <dt className="eyebrow">Largest transaction</dt>
              <dd className="mt-2 text-2xl tabular-nums">{formatUsd(behavior.largest)}</dd>
            </div>
          </dl>
          <ul className="mt-8 border-t border-line">
            {behavior.shares.map((share) => (
              <li key={share.label} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line py-3">
                <div>
                  <p className="text-sm">{share.label}</p>
                  <div className="mt-2 h-px bg-line">
                    <div className="h-px bg-ink" style={{ width: `${Math.max(2, share.value * 100)}%` }} />
                  </div>
                </div>
                <p className="font-mono text-sm text-muted">{Math.round(share.value * 100)}%</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
