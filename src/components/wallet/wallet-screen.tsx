"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { layoutActivity } from "@/lib/graph/layout";
import { withinRange, type TimeRange } from "@/lib/format";
import type { ActivityEvent, ActivityFilter, WalletView } from "@/lib/types";
import { ActivityGraph } from "@/components/graph/activity-graph";
import { ActivityTimeline } from "@/components/wallet/activity-timeline";
import { BehaviorSection } from "@/components/wallet/behavior-section";
import { TransactionDrawer } from "@/components/wallet/transaction-drawer";
import { WalletHeader } from "@/components/wallet/wallet-header";
import { WalletStats } from "@/components/wallet/wallet-stats";
import { WatchWalletModal } from "@/components/wallet/watch-modal";
import { EmptyState, ErrorState } from "@/components/ui/states";

const RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "ALL" },
];

const FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "transfer", label: "Transfers" },
  { id: "swap", label: "Swaps" },
  { id: "defi", label: "DeFi" },
  { id: "nft", label: "NFT" },
  { id: "contract", label: "Contracts" },
];

export function WalletScreen({
  view,
  now,
  initialFilter = "all",
  initialAsset = "",
  initialTx = "",
}: {
  view: WalletView;
  now: number;
  initialFilter?: string;
  initialAsset?: string;
  initialTx?: string;
}) {
  const router = useRouter();
  const [range, setRange] = useState<TimeRange>("all");
  const [filter, setFilter] = useState<ActivityFilter>(isFilter(initialFilter) ? initialFilter : "all");
  const [asset] = useState(initialAsset.toUpperCase());
  const [selected, setSelected] = useState<ActivityEvent | null>(() => {
    if (!initialTx) return null;
    return view.events.find((event) => event.hash.toLowerCase() === initialTx.toLowerCase()) ?? null;
  });
  const [watchOpen, setWatchOpen] = useState(false);

  const filtered = useMemo(
    () =>
      view.events.filter((event) => {
        if (!withinRange(event.timestamp, range, now)) return false;
        if (filter !== "all" && event.type !== filter) return false;
        if (asset && event.asset.toUpperCase() !== asset && event.counterAsset?.toUpperCase() !== asset) return false;
        return true;
      }),
    [asset, filter, now, range, view.events],
  );

  const model = useMemo(() => layoutActivity(filtered, view.address), [filtered, view.address]);

  if (view.error) {
    return (
      <main className="mx-auto max-w-[1360px] px-6 py-16 md:px-10">
        <ErrorState
          title={view.error.title}
          body={view.error.body}
          technical={view.error.technical}
          onRetry={() => router.refresh()}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-10 md:px-10 md:py-14">
      <WalletHeader view={view} onWatch={() => setWatchOpen(true)} />
      <WalletStats view={view} now={now} />

      <section className="mt-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="text-3xl tracking-tight">Activity</h2>
          <div className="flex gap-4 text-sm">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={range === item.id ? "text-ink" : "text-faint hover:text-muted"}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={filter === item.id ? "text-ink underline decoration-brass underline-offset-4" : "text-faint hover:text-muted"}
            >
              {item.label}
            </button>
          ))}
          {asset ? <span className="font-mono text-xs text-brass">{asset}</span> : null}
        </div>
        <div className={`mt-4 border-t border-line ${filtered.length > 0 ? "md:h-[420px]" : ""}`}>
          {view.events.length === 0 ? (
            <div className="pt-10">
              <EmptyState
                title="Nothing here yet."
                body="Watch this wallet and we'll surface meaningful activity here."
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="pt-10">
              <EmptyState title="Nothing in this range." body="Widen the window or clear the filter to see activity." />
            </div>
          ) : (
            <ActivityGraph model={model} chain={view.chain} onOpenEdge={(edge) => setSelected(edge.latest)} />
          )}
        </div>
      </section>

      <BehaviorSection events={filtered} />
      {filtered.length > 0 ? (
        <ActivityTimeline key={`${range}:${filter}:${asset}`} events={filtered} now={now} onSelect={setSelected} />
      ) : null}
      <TransactionDrawer
        event={selected}
        demo={view.source === "demo"}
        explorer={view.explorer}
        nativeSymbol={view.nativeSymbol}
        onClose={() => setSelected(null)}
      />
      <WatchWalletModal open={watchOpen} address={view.address} chain={view.chain} onClose={() => setWatchOpen(false)} />
    </main>
  );
}

function isFilter(value: string): value is ActivityFilter {
  return ["all", "transfer", "swap", "defi", "nft", "contract"].includes(value);
}
