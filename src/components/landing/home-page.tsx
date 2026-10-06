import Link from "next/link";
import { ActivityGraph } from "@/components/graph/activity-graph";
import { AddressForm } from "@/components/landing/address-form";
import { ActivityClock } from "@/components/wallet/activity-clock";
import { heroModel, storyModel } from "@/lib/graph/hero";
import { defaultChainId, walletHref } from "@/lib/chains/catalog";
import { DEMO_ADDRESS } from "@/lib/parties";
import { SAMPLE_HOURS } from "@/lib/behavior";

export function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-[1360px] px-6 pt-16 md:px-10 md:pt-24">
        <p className="eyebrow">Wallet intelligence</p>
        <h1 className="mt-6 max-w-[12ch] text-[clamp(3.4rem,7.6vw,6.8rem)] leading-[0.9] font-medium tracking-[-0.045em]">
          Know when a wallet moves.
        </h1>
        <p className="mt-8 max-w-md text-[17px] leading-relaxed text-muted">
          Track wallets. Understand activity. Get alerted when something matters.
        </p>
        <div className="mt-10">
          <AddressForm defaultChain={defaultChainId()} />
        </div>
        <Link href={walletHref(DEMO_ADDRESS, "ethereum")} className="mt-5 inline-block text-sm text-muted hover:text-ink">
          Explore demo
        </Link>
      </section>

      <section className="mx-auto mt-16 max-w-[1360px] px-6 md:px-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <p className="eyebrow">Sample flow · Ethereum</p>
          <p className="text-xs text-faint">
            <span className="text-inflow">Inflow</span>
            <span className="px-2">·</span>
            <span className="text-outflow">Outflow</span>
          </p>
        </div>
        <div className="border-t border-line md:h-[620px]">
          <ActivityGraph model={heroModel} interactive={false} />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1360px] items-center gap-16 px-6 py-28 md:grid-cols-12 md:px-10 md:py-36">
        <div className="md:col-span-4">
          <h2 className="text-5xl leading-[0.95] font-medium tracking-[-0.04em]">Follow the money.</h2>
          <p className="mt-6 max-w-sm text-muted">
            A deposit, a swap, a transfer. The path stays visible.
          </p>
        </div>
        <div className="md:col-span-8 md:h-[140px]">
          <ActivityGraph model={storyModel} interactive={false} />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1360px] gap-16 px-6 py-28 md:grid-cols-12 md:px-10 md:py-36">
          <div className="md:col-span-5">
            <h2 className="text-5xl leading-[0.95] font-medium tracking-[-0.04em]">See behavior, not noise.</h2>
            <p className="mt-6 max-w-sm text-muted">
              Hours, size, and counterparties. Measured from the activity itself.
            </p>
            <dl className="mt-12 max-w-sm">
              <Stat label="Most active" value="09:00–13:00 UTC" />
              <Stat label="Average transaction" value="$8,420" />
              <Stat label="Largest transaction" value="$284,120" />
            </dl>
            <p className="mt-6 text-xs text-faint">Sample · vault.eth</p>
          </div>
          <div className="md:col-span-7 md:pl-10">
            <ActivityClock hours={SAMPLE_HOURS} start={9} />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1360px] px-6 py-28 md:px-10 md:py-36">
          <h2 className="text-5xl leading-[0.95] font-medium tracking-[-0.04em]">Get the signal.</h2>
          <ul className="mt-14 border-t border-line">
            {SIGNALS.map((signal) => (
              <li key={signal.title} className="grid gap-2 border-b border-line py-6 md:grid-cols-12">
                <p className="text-lg md:col-span-4">{signal.title}</p>
                <p className="text-muted md:col-span-8">{signal.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1360px] px-6 py-28 md:px-10 md:py-36">
          <h2 className="max-w-[14ch] text-5xl leading-[0.95] font-medium tracking-[-0.04em]">
            Built for people who watch wallets.
          </h2>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.index} className="border-t border-line pt-6">
                <p className="eyebrow">{pillar.index}</p>
                <h3 className="mt-4 text-2xl tracking-tight">{pillar.title}</h3>
                <p className="mt-3 text-muted">{pillar.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-16">
            <AddressForm id="watch-again" defaultChain={defaultChainId()} />
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-3 px-6 py-8 text-sm text-faint md:flex-row md:items-center md:justify-between md:px-10">
          <p>Wallet Watch</p>
          <p>Ethereum · Demo data ships with the product</p>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-3">
      <dt className="text-sm text-faint">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}

const SIGNALS = [
  { title: "Any transaction", body: "Every movement, if you want the full tape." },
  { title: "Transfers over $10,000", body: "Ignore dust. Keep the transfers that matter." },
  { title: "ETH and stablecoins", body: "Native assets and dollar tokens, separately." },
  { title: "A DEX or a new contract", body: "Swaps, and the first time a wallet touches unknown code." },
];

const PILLARS = [
  { index: "01", title: "Index", body: "Transfers, swaps, and contract calls, normalized." },
  { index: "02", title: "Watch", body: "Rules and thresholds. You decide what is worth a notification." },
  { index: "03", title: "Signal", body: "Email, Telegram, Discord, or a webhook. The rest stays quiet." },
];
