import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { appUrl, billingConfigured, isPaidPlan, priceFor, stripe } from "@/lib/billing/stripe";
import { isPlanId, PLANS } from "@/lib/plans";
import { getStore } from "@/lib/store";

const schema = z.object({
  plan: z.string(),
});

function fail(title: string, status: number, body?: string) {
  return Response.json({ error: { title, body } }, { status });
}

/**
 * Choose a plan.
 *
 * Without Stripe the plan is saved on the account and the response says so.
 * With Stripe:
 *   - a paid plan with no live subscription opens Checkout,
 *   - any change with a live subscription opens the customer portal,
 *   - Observer with no subscription is set directly.
 * The plan itself is only ever written by the webhook once money is involved.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Sign in to change plans.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPlanId(parsed.data.plan)) return fail("That plan isn't available.", 400);
  const plan = parsed.data.plan;
  const store = await getStore();

  if (!billingConfigured()) {
    const updated = await store.setPlan(user.id, plan);
    return Response.json({
      user: updated,
      connected: false,
      message: "Billing isn't connected in this environment. Your plan is saved on this account.",
    });
  }

  const billing = await store.getBilling(user.id);
  const origin = appUrl(request);
  const returnUrl = `${origin}/dashboard/billing`;

  // Anything with a subscription behind it is changed in the portal, so proration and cancellation stay with Stripe.
  if (billing.subscriptionId) {
    if (!billing.customerId) return fail("This account's billing record is incomplete.", 500);
    const session = await stripe().billingPortal.sessions.create({
      customer: billing.customerId,
      return_url: returnUrl,
    });
    return Response.json({ url: session.url });
  }

  if (!isPaidPlan(plan)) {
    const updated = await store.setPlan(user.id, plan);
    return Response.json({ user: updated, connected: true });
  }

  const price = priceFor(plan);
  if (!price) return fail(`${PLANS[plan].name} has no price configured.`, 503);

  let customerId = billing.customerId;
  if (!customerId) {
    const customer = await stripe().customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await store.setBilling(user.id, { customerId });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: user.id, plan } },
    success_url: `${returnUrl}?checkout=success`,
    cancel_url: `${returnUrl}?checkout=cancelled`,
  });
  if (!session.url) return fail("Stripe did not return a checkout page.", 502);
  return Response.json({ url: session.url });
}
