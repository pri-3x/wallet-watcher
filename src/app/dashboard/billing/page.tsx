import { BillingPanel } from "@/components/dashboard/billing-panel";
import { SignInPanel } from "@/components/dashboard/sign-in";
import { loadDesk } from "@/lib/dashboard";

export default async function BillingPage() {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;

  return (
    <div>
      <h1 className="text-5xl tracking-tight">Billing</h1>
      <p className="mt-4 max-w-md text-muted">Three desks. The limit is wallets under watch, not a pile of features.</p>
      <BillingPanel current={desk.user.plan} />
    </div>
  );
}
