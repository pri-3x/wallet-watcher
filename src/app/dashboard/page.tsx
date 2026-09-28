import { AlertTimeline } from "@/components/dashboard/alert-timeline";
import { Greeting } from "@/components/dashboard/greeting";
import { SignInPanel } from "@/components/dashboard/sign-in";
import { WalletList } from "@/components/dashboard/wallet-list";
import { loadDesk } from "@/lib/dashboard";

export default async function DashboardPage() {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;

  return (
    <div>
      <Greeting now={desk.now} />
      <p className="mt-4 text-sm text-muted">{desk.user.email}</p>
      <section className="mt-16">
        <h2 className="eyebrow">Watched wallets</h2>
        <div className="mt-6">
          <WalletList wallets={desk.wallets} now={desk.now} />
        </div>
      </section>
      <section className="mt-16">
        <h2 className="text-3xl tracking-tight">Latest alerts</h2>
        <div className="mt-6">
          <AlertTimeline alerts={desk.alerts.slice(0, 6)} now={desk.now} />
        </div>
      </section>
    </div>
  );
}
