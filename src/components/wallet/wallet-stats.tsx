import { formatISODate, formatUsd } from "@/lib/format";
import type { WalletView } from "@/lib/types";
import { RelativeTime } from "@/components/ui/figures";

export function WalletStats({ view, now }: { view: WalletView; now: number }) {
  const holdings = view.holdings.map((holding) => `${holding.amount} ${holding.symbol}`).join(" · ");

  return (
    <section className="mt-12 border-t border-line">
      <dl className="grid grid-cols-2 gap-x-8 md:grid-cols-4">
        <Stat label="Balance" value={formatUsd(view.balanceUsd)} detail={holdings} />
        <Stat label="Transactions" value={view.txCount.toLocaleString("en-US")} />
        <Stat label="First seen" value={formatISODate(view.firstSeen)} />
        <div className="border-t border-line py-5">
          <dt className="eyebrow">Last active</dt>
          <dd className="mt-3 text-2xl tracking-tight">
            <RelativeTime timestamp={view.lastActive} now={now} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-t border-line py-5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-3 text-2xl tracking-tight tabular-nums">{value}</dd>
      {detail ? <p className="mt-2 font-mono text-xs text-faint">{detail}</p> : null}
    </div>
  );
}
