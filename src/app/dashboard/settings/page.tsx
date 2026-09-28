import { DeliveryTest } from "@/components/dashboard/delivery-test";
import { SignInPanel } from "@/components/dashboard/sign-in";
import { SignOutButton } from "@/components/dashboard/sign-out";
import { activeNetwork } from "@/lib/chains/ethereum";
import { providerStates } from "@/lib/notifications/dispatch";
import { PLANS } from "@/lib/plans";
import { loadDesk } from "@/lib/dashboard";

export default async function SettingsPage() {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;
  const plan = PLANS[desk.user.plan];
  const providers = providerStates();
  const network = activeNetwork();

  return (
    <div className="max-w-xl">
      <h1 className="text-5xl tracking-tight">Settings</h1>
      <dl className="mt-12 border-t border-line">
        <Row label="Email" value={desk.user.email} />
        <Row label="Plan" value={plan.name} />
        <Row label="Network" value={network.id === "sepolia" ? "Sepolia testnet" : "Ethereum mainnet"} />
      </dl>

      <section className="mt-16">
        <p className="eyebrow">Delivery</p>
        <h2 className="mt-3 text-2xl tracking-tight">Where signals can go.</h2>
        <ul className="mt-6 border-t border-line">
          {providers.map((provider) => (
            <li key={provider.channel} className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4 border-b border-line py-3 text-sm">
              <span>{provider.label}</span>
              <span className="text-muted">{provider.note}</span>
              <span className={`text-xs tracking-wide uppercase ${provider.ready ? "text-inflow" : "text-faint"}`}>
                {provider.ready ? "Ready" : "Not set"}
              </span>
            </li>
          ))}
        </ul>
        <DeliveryTest
          channels={providers.filter((provider) => provider.ready).map((provider) => provider.channel)}
          defaultEmail={desk.user.email}
        />
        <p className="mt-6 text-sm text-faint">
          Channels are chosen per watch. History recorded when a watch is created is kept but never sent.
        </p>
      </section>

      <div className="mt-16">
        <SignOutButton />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-4">
      <dt className="eyebrow">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
