"use client";

import { useState } from "react";
import { shortAddress } from "@/lib/address";
import { addressUrl } from "@/lib/chains/catalog";
import type { WalletView } from "@/lib/types";

export function WalletHeader({
  view,
  onWatch,
}: {
  view: WalletView;
  onWatch: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(view.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow">Wallet</p>
        {view.ensName ? <p className="mt-4 text-sm tracking-[0.14em] text-brass uppercase">{view.ensName}</p> : null}
        <h1 className="mt-3 font-mono text-3xl tracking-tight md:text-5xl">{shortAddress(view.address, 6, 4)}</h1>
        <p className="mt-3 text-sm text-muted">
          {view.chainLabel}
          {view.note ? <span className="text-faint"> · {view.note}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onWatch} className="h-10 bg-ink px-4 text-sm text-canvas active:translate-y-px">
          + Watch wallet
        </button>
        <button type="button" onClick={copy} className="h-10 border border-line px-4 text-sm active:translate-y-px">
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={addressUrl(view.chain, view.address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center border border-line px-4 text-sm"
        >
          Explorer ↗
        </a>
      </div>
    </header>
  );
}
