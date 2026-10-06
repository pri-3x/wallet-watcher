"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { shortAddress } from "@/lib/address";
import { findChain, walletHref } from "@/lib/chains/catalog";
import { formatAmount, formatUsd, formatUsdCompact } from "@/lib/format";
import { placeHolders, type TokenOverview } from "@/lib/tokens/overview";

export function TokenScreen({ overview }: { overview: TokenOverview }) {
  const router = useRouter();
  const chain = findChain(overview.chainId);
  const [active, setActive] = useState<string | null>(null);
  const placed = useMemo(
    () => placeHolders(overview.flowHolders.map((holder) => holder.share)),
    [overview.flowHolders],
  );
  const nodes = overview.flowHolders.map((holder, index) => ({ ...holder, ...placed[index]! }));
  const byAddress = new Map(nodes.map((node) => [node.address.toLowerCase(), node]));
  const maxDepth = Math.max(...overview.depth.map((row) => row.count), 1);

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-10 md:px-10 md:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Token</p>
          <h1 className="mt-3 text-5xl tracking-tight">{overview.name}</h1>
          <p className="mt-3 text-sm text-muted">
            {overview.symbol}
            <span className="text-faint"> · {chain?.name ?? overview.chainId}</span>
            <span className="text-faint"> · {overview.holdersCount.toLocaleString("en-US")} holders</span>
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="font-mono text-2xl tracking-tight">{overview.price > 0 ? formatUsd(overview.price, 4) : "—"}</p>
          <p className="mt-1 text-sm text-faint">{overview.marketCap > 0 ? `${formatUsdCompact(overview.marketCap)} cap` : "Price unavailable"}</p>
        </div>
      </header>

      <section className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Top 100" value={percent(overview.top100)} detail={`Top 10 hold ${percent(overview.top10)} · Top 5 hold ${percent(overview.top5)}`} />
        <Stat
          label="Whales"
          value={percent(overview.whaleShare)}
          detail={`${overview.whaleCount.toLocaleString("en-US")} wallets · ${percent(overview.whaleHolderShare)} of holders · $100k or more`}
        />
        <Stat label="Distribution" value={overview.gini.toFixed(3)} detail="Estimated from the largest 100 holders. 1.000 means one wallet holds everything." />
        <Stat label="At least 1%" value={overview.atLeastOnePercent.toLocaleString("en-US")} detail="Holders with 1% of the supply or more." />
      </section>

      <div className="mt-8">
        <div className="flex h-2 w-full overflow-hidden bg-line">
          {overview.bands.map((band, index) => (
            <div
              key={band.label}
              title={`${band.label} ${percent(band.share)}`}
              style={{ width: `${band.share * 100}%`, opacity: [1, 0.72, 1, 0.62, 0.34, 1][index] ?? 1 }}
              className={index === 0 ? "bg-brass" : index === overview.bands.length - 1 ? "bg-line-strong" : index < 2 ? "bg-brass" : "bg-ink"}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
          {overview.bands.map((band) => (
            <span key={band.label}>
              {band.label} {percent(band.share)}
            </span>
          ))}
        </div>
      </div>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Flow</p>
            <h2 className="mt-3 text-3xl tracking-tight">Who holds it.</h2>
          </div>
          <p className="text-xs text-faint">Circle size is share of supply.</p>
        </div>
        <div className="mt-6 grid border-t border-line lg:grid-cols-[1fr_280px]">
          <svg viewBox="0 0 640 420" className="h-[420px] w-full bg-canvas">
            {overview.flowEdges.map((edge) => {
              const from = byAddress.get(edge.from);
              const to = byAddress.get(edge.to);
              if (!from || !to) return null;
              const hot = active === edge.from || active === edge.to;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="var(--brass)"
                  strokeWidth={hot ? 1.6 : 0.6}
                  opacity={hot ? 0.9 : 0.35}
                />
              );
            })}
            {nodes.map((node) => {
              const on = active === node.address.toLowerCase();
              return (
                <g
                  key={node.address}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setActive(node.address.toLowerCase())}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => router.push(walletHref(node.address, overview.chainId))}
                >
                  <circle cx={node.x} cy={node.y} r={node.r} fill={on ? "var(--brass)" : "var(--ink)"} opacity={on ? 1 : 0.9} />
                  {node.r > 28 ? (
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fill="var(--canvas)" fontSize="11" fontFamily="ui-monospace, monospace">
                      {percent(node.share)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          <ol className="max-h-[420px] overflow-auto border-t border-line lg:border-t-0 lg:border-l">
            {nodes.map((node, index) => (
              <li key={node.address}>
                <Link
                  href={walletHref(node.address, overview.chainId)}
                  onMouseEnter={() => setActive(node.address.toLowerCase())}
                  onMouseLeave={() => setActive(null)}
                  className={`flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm ${
                    active === node.address.toLowerCase() ? "bg-wash" : ""
                  }`}
                >
                  <span className="truncate">
                    <span className="mr-2 font-mono text-xs text-faint">{index + 1}</span>
                    {node.label === "Wallet" ? shortAddress(node.address) : node.label}
                  </span>
                  <span className="font-mono text-xs text-brass">{percent(node.share)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-16 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl tracking-tight">Tiers</h2>
          <p className="mt-2 text-sm text-faint">Whales are $100k and up. The last row is everyone outside the top 100.</p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {overview.tiers.filter((tier) => tier.count > 0).map((tier) => (
                <tr key={tier.label} className="border-t border-line">
                  <td className="py-2.5">{tier.label}</td>
                  <td className="py-2.5 text-right font-mono text-xs">{tier.count.toLocaleString("en-US")}</td>
                  <td className="py-2.5 text-right font-mono text-xs text-faint">{percent(tier.holderShare)}</td>
                  <td className="py-2.5 text-right font-mono text-xs text-brass">{percent(tier.capShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-2xl tracking-tight">Wallet depth</h2>
          <p className="mt-2 text-sm text-faint">How many of the top 100 clear each size.</p>
          <ul className="mt-4 space-y-2">
            {overview.depth.map((row) => (
              <li key={row.label} className="grid grid-cols-[72px_1fr_40px] items-center gap-3 text-sm">
                <span className="font-mono text-xs text-faint">{row.label}</span>
                <span className="h-1.5 bg-line">
                  <span className="block h-full bg-inflow" style={{ width: `${(row.count / maxDepth) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-xs">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl tracking-tight">Largest holders</h2>
        <ol className="mt-4 border-t border-line">
          {overview.holders.map((holder, index) => (
            <li key={holder.address} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-line py-3 text-sm">
              <span className="font-mono text-xs text-faint">{index + 1}</span>
              <Link href={walletHref(holder.address, overview.chainId)} className="truncate hover:text-brass">
                {holder.label === "Wallet" ? shortAddress(holder.address) : holder.label}
                {holder.label !== "Wallet" ? <span className="ml-2 font-mono text-xs text-faint">{shortAddress(holder.address)}</span> : null}
              </Link>
              <span className="text-right">
                <span className="font-mono text-xs">{formatAmount(holder.amount)} {overview.symbol}</span>
                <span className="ml-3 font-mono text-xs text-brass">{percent(holder.share)}</span>
                {holder.usd > 0 ? <span className="ml-3 font-mono text-xs text-faint">{formatUsdCompact(holder.usd)}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-canvas px-4 py-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-mono text-2xl tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-faint">{detail}</p>
    </div>
  );
}

function percent(share: number) {
  return `${(share * 100).toFixed(share > 0 && share < 0.001 ? 3 : 2)}%`;
}
