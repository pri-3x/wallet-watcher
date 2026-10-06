import Link from "next/link";
import { SignInPanel } from "@/components/dashboard/sign-in";
import { RelativeTime } from "@/components/ui/figures";
import { EmptyState } from "@/components/ui/states";
import { shortAddress } from "@/lib/address";
import { walletHref } from "@/lib/chains/catalog";
import { loadDesk } from "@/lib/dashboard";
import { formatUsd } from "@/lib/format";

export default async function ActivityPage() {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;

  const events = desk.wallets
    .flatMap(({ view }) => view.events.map((event) => ({ event, address: view.address, chain: view.chain })))
    .sort((a, b) => b.event.timestamp - a.event.timestamp)
    .slice(0, 30);

  return (
    <div>
      <h1 className="text-5xl tracking-tight">Activity</h1>
      {events.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Nothing here yet." body="Watch a wallet and we'll surface meaningful activity here." />
        </div>
      ) : (
        <ol className="mt-10 border-t border-line">
          {events.map(({ event, address, chain }) => (
            <li key={`${chain}-${address}-${event.id}`} className="border-b border-line">
              <Link href={walletHref(address, chain, { tx: event.hash })} className="grid gap-2 py-5 md:grid-cols-[140px_1fr_auto]">
                <span className="text-sm text-muted">
                  <RelativeTime timestamp={event.timestamp} now={desk.now} />
                </span>
                <span>
                  <span className="block text-lg tracking-tight">{event.summary}</span>
                  <span className="mt-1 block font-mono text-xs text-faint">{shortAddress(address)}</span>
                </span>
                <span className="font-mono text-sm">{event.amountUsd > 0 ? formatUsd(event.amountUsd) : ""}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
