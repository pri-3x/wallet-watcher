"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { shortAddress } from "@/lib/address";
import { COOLDOWN_OPTIONS, cooldownPhrase } from "@/lib/alerts/quiet";
import { formatUsdCompact } from "@/lib/format";
import type { WalletView } from "@/lib/types";
import type { WatchRecord } from "@/lib/store/types";
import { RelativeTime } from "@/components/ui/figures";

export function WalletList({
  wallets,
  now,
  removable = false,
}: {
  wallets: Array<{ watch: WatchRecord; view: WalletView }>;
  now: number;
  removable?: boolean;
}) {
  const router = useRouter();

  async function remove(id: string) {
    await fetch(`/api/watches/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function setCooldown(id: string, cooldownMs: number) {
    const response = await fetch(`/api/watches/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cooldownMs }),
    });
    if (response.ok) router.refresh();
  }
  if (wallets.length === 0) {
    return (
      <div className="border-y border-line py-12">
        <h3 className="text-2xl tracking-tight">Nothing here yet.</h3>
        <p className="mt-3 max-w-md text-muted">Watch a wallet and it will live on this desk.</p>
        <Link href={`/wallet/${"0x7A91c4E8b2D15F6a903C81E4d7B291F0a8c3e91F"}`} className="mt-6 inline-block text-sm text-ink">
          Explore the demo wallet
        </Link>
      </div>
    );
  }

  return (
    <ul className="border-t border-line">
      {wallets.map(({ watch, view }) => (
        <li key={watch.id} className="border-b border-line">
          <div className="flex items-baseline justify-between gap-6 py-5">
            <div>
              <Link href={`/wallet/${view.address}`} className="font-mono text-sm hover:text-brass">
                {view.ensName ?? shortAddress(view.address)}
              </Link>
              <p className="mt-2 text-sm text-muted">
                Last activity <RelativeTime timestamp={view.lastActive} now={now} />
                <span className="text-faint"> · {cooldownPhrase(watch.cooldownMs)}</span>
              </p>
              {removable ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {COOLDOWN_OPTIONS.map((option) => (
                    <button
                      key={option.ms}
                      type="button"
                      onClick={() => void setCooldown(watch.id, option.ms)}
                      className={`h-8 border px-2 text-xs ${
                        watch.cooldownMs === option.ms ? "border-ink text-ink" : "border-line text-muted"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <p className="font-mono text-sm">{formatUsdCompact(view.balanceUsd)}</p>
              {removable ? (
                <button type="button" onClick={() => void remove(watch.id)} className="mt-2 text-xs text-faint hover:text-outflow">
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
