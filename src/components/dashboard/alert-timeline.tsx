import Link from "next/link";
import { shortAddress } from "@/lib/address";
import { walletHref } from "@/lib/chains/catalog";
import type { StoredAlert } from "@/lib/store/types";
import { RelativeTime } from "@/components/ui/figures";

export function AlertTimeline({ alerts, now }: { alerts: StoredAlert[]; now: number }) {
  if (alerts.length === 0) {
    return (
      <div className="border-y border-line py-12">
        <h3 className="text-2xl tracking-tight">Nothing here yet.</h3>
        <p className="mt-3 max-w-md text-muted">When a rule matches, the signal shows up here.</p>
      </div>
    );
  }

  return (
    <ol className="border-t border-line">
      {alerts.map((alert) => (
        <li key={alert.id} className="grid gap-2 border-b border-line py-5 md:grid-cols-[140px_1fr_auto] md:gap-8">
          <p className="text-sm text-muted">
            <RelativeTime timestamp={alert.timestamp} now={now} />
          </p>
          <div>
            <p className="text-sm text-brass">{alert.summary}</p>
            <p className="mt-1 text-lg tracking-tight">{alert.detail}</p>
            <Link href={walletHref(alert.address, alert.chain, { tx: alert.hash })} className="mt-2 inline-block font-mono text-xs text-faint hover:text-ink">
              {shortAddress(alert.address)}
            </Link>
          </div>
          <p className="text-xs tracking-wide text-faint uppercase">{deliveryLabel(alert.delivery)}</p>
        </li>
      ))}
    </ol>
  );
}

function deliveryLabel(status: string) {
  if (status === "delivered") return "Delivered";
  if (status === "logged") return "Logged";
  if (status === "failed") return "Failed";
  if (status === "retry") return "Retrying";
  if (status === "pending" || status === "sending") return "Queued";
  return status;
}
