import type Stripe from "stripe";
import { planFromSubscription } from "@/lib/billing/plan-from-subscription";
import { billingConfigured, planForPrice, stripe } from "@/lib/billing/stripe";
import { getStore } from "@/lib/store";

/**
 * Stripe → plan. This is the only place a paid plan is granted or removed.
 *
 * Every event that matters carries a subscription, so they all funnel into
 * applySubscription. Unknown events return 200 so Stripe stops retrying them.
 */
export async function POST(request: Request) {
  if (!billingConfigured()) return new Response("Billing not configured", { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET is unset", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch (error) {
    console.warn("[billing] Rejected webhook:", error instanceof Error ? error.message : error);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe().subscriptions.retrieve(id);
        await applySubscription(subscription, session.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[billing] ${event.type} failed:`, error);
    return new Response("Handler failed", { status: 500 });
  }

  return Response.json({ received: true });
}

async function applySubscription(subscription: Stripe.Subscription, userIdHint?: string | null) {
  const store = await getStore();
  const change = planFromSubscription(subscription, planForPrice);
  const customerId = change.billing.customerId ?? null;

  const user =
    (userIdHint ? await store.getUserById(userIdHint) : null) ??
    (subscription.metadata?.userId ? await store.getUserById(subscription.metadata.userId) : null) ??
    (customerId ? await store.getUserByCustomerId(customerId) : null);

  if (!user) {
    console.warn(`[billing] No account for customer ${customerId ?? "?"} on ${subscription.id}`);
    return;
  }

  await store.setBilling(user.id, change.billing);
  if (user.plan !== change.plan) await store.setPlan(user.id, change.plan);
  console.log(`[billing] ${user.email} → ${change.plan} (${subscription.status})`);
}
