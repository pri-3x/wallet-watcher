import { BillingPanel } from "@/components/dashboard/billing-panel";
import { SignInPanel } from "@/components/dashboard/sign-in";
import { billingConfigured, purchasablePlans } from "@/lib/billing/stripe";
import { PLAN_LABEL, razorpayConfigured } from "@/lib/billing/razorpay";
import { loadDesk } from "@/lib/dashboard";
import { PLANS } from "@/lib/plans";
import { getStore } from "@/lib/store";

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const desk = await loadDesk();
  if (!desk.user) return <SignInPanel />;

  const store = await getStore();
  const [billing, watches] = await Promise.all([store.getBilling(desk.user.id), store.listWatches(desk.user.id)]);
  const checkout = (await searchParams).checkout;
  const razorpay = razorpayConfigured();
  const stripeOn = billingConfigured();
  const provider = razorpay ? "razorpay" : stripeOn ? "stripe" : "none";
  const limit = PLANS[desk.user.plan].walletLimit;

  return (
    <div>
      <h1 className="text-5xl tracking-tight">Billing</h1>
      <p className="mt-4 max-w-md text-muted">Three desks. The limit is wallets under watch, not a pile of features.</p>
      <dl className="mt-12 border-t border-line">
        <Row label="Current desk" value={PLANS[desk.user.plan].name} />
        <Row
          label="Wallets"
          value={Number.isFinite(limit) ? `${watches.length} of ${limit}` : `${watches.length} · no limit`}
        />
        {billing.periodEnd ? (
          <Row
            label={billing.status === "paid" ? "Paid until" : billing.cancelAtPeriodEnd ? "Ends" : "Renews"}
            value={new Date(billing.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          />
        ) : null}
        {billing.status === "past_due" ? (
          <Row label="Payment" value="The last charge failed. Update the card to keep this desk." tone="warn" />
        ) : null}
      </dl>
      <BillingPanel
        current={desk.user.plan}
        provider={provider}
        email={desk.user.email}
        purchasable={razorpay ? ["desk", "terminal"] : stripeOn ? purchasablePlans() : ["desk", "terminal"]}
        hasCustomer={Boolean(billing.customerId)}
        subscribed={Boolean(billing.subscriptionId) && provider === "stripe"}
        checkout={checkout === "success" ? "success" : checkout === "cancelled" ? "cancelled" : null}
        prices={
          razorpay
            ? { desk: PLAN_LABEL.desk.price, terminal: PLAN_LABEL.terminal.price, deskDetail: PLAN_LABEL.desk.detail, terminalDetail: PLAN_LABEL.terminal.detail }
            : null
        }
      />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-4">
      <dt className="eyebrow">{label}</dt>
      <dd className={`text-right ${tone === "warn" ? "text-outflow" : ""}`}>{value}</dd>
    </div>
  );
}
