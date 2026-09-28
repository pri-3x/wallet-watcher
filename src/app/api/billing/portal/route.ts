import { getSessionUser } from "@/lib/auth/session";
import { appUrl, billingConfigured, stripe } from "@/lib/billing/stripe";
import { getStore } from "@/lib/store";

/** Opens Stripe's customer portal: invoices, card, cancel, change plan. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in first." } }, { status: 401 });
  if (!billingConfigured()) {
    return Response.json({ error: { title: "Billing isn't connected in this environment." } }, { status: 503 });
  }
  const store = await getStore();
  const billing = await store.getBilling(user.id);
  if (!billing.customerId) {
    return Response.json({ error: { title: "There is no billing history on this account yet." } }, { status: 404 });
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: billing.customerId,
    return_url: `${appUrl(request)}/dashboard/billing`,
  });
  return Response.json({ url: session.url });
}
