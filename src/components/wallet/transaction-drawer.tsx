"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { shortAddress } from "@/lib/address";
import { formatAmount, formatTimestamp, formatUsd } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

export function TransactionDrawer({
  event,
  demo,
  explorer,
  nativeSymbol = "ETH",
  onClose,
}: {
  event: ActivityEvent | null;
  demo: boolean;
  explorer: string;
  nativeSymbol?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!event) return;
    await navigator.clipboard.writeText(event.hash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <AnimatePresence>
      {event ? (
        <>
          <motion.button
            type="button"
            aria-label="Close transaction"
            className="fixed inset-0 z-40 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Transaction"
            className="fixed top-0 right-0 z-40 flex h-full w-full max-w-[420px] flex-col border-l border-line bg-canvas px-6 py-8 md:px-8"
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 28, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
          >
            <div className="flex items-center justify-between">
              <p className="eyebrow">Transaction</p>
              <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>
            <p className="mt-6 font-mono text-sm text-muted">{shortAddress(event.hash, 8, 4)}</p>
            <p className="mt-8 text-3xl tracking-tight">
              {formatAmount(event.amount)} {event.asset}
            </p>
            <p className="mt-2 font-mono text-muted">{event.amountUsd > 0 ? formatUsd(event.amountUsd) : "—"}</p>
            {event.detail ? <p className="mt-4 text-sm text-muted">{event.detail}</p> : null}

            <dl className="mt-10 border-t border-line">
              <Row label="From" value={event.from.label === shortAddress(event.from.address) ? shortAddress(event.from.address) : `${event.from.label}`} mono={event.from.address} />
              <Row label="To" value={event.to.label} mono={event.to.address} />
              <Row label="Type" value={labelFor(event.type)} />
              <Row label="Block" value={event.blockNumber.toLocaleString("en-US")} />
              <Row label="Fee" value={`${event.gasEth} ${nativeSymbol}`} />
              <Row label="Timestamp" value={formatTimestamp(event.timestamp)} />
            </dl>

            {demo ? (
              <p className="mt-6 text-sm text-faint">Sample transaction. It will not resolve on a block explorer.</p>
            ) : null}

            <div className="mt-auto flex gap-2 pt-8">
              <a
                href={`${explorer}/tx/${event.hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center border border-line px-4 text-sm"
              >
                View on explorer ↗
              </a>
              <button type="button" onClick={copy} className="h-10 border border-line px-4 text-sm">
                {copied ? "Copied" : "Copy transaction"}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-line py-3">
      <dt className="eyebrow pt-1">{label}</dt>
      <dd>
        <p className="text-sm">{value}</p>
        {mono && mono !== value ? <p className="mt-1 font-mono text-xs text-faint">{shortAddress(mono)}</p> : null}
      </dd>
    </div>
  );
}

function labelFor(type: ActivityEvent["type"]) {
  if (type === "transfer") return "Transfer";
  if (type === "swap") return "Swap";
  if (type === "defi") return "DeFi";
  if (type === "nft") return "NFT";
  return "Contract";
}
