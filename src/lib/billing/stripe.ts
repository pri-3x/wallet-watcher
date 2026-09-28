import Stripe from "stripe";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Stripe is optional. With no secret key the billing page still saves a plan
 * name on the account and says so. With a key, paid plans go through Checkout
 * and the plan is set by the webhook, never by the browser.
 */

export type PaidPlan = Exclude<PlanId, "observer">;

let client: Stripe | undefined;

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is unset");
  client ??= new Stripe(key, { appInfo: { name: "Wallet Watch" } });
  return client;
}

const PRICE_ENV: Record<PaidPlan, string> = {
  desk: "STRIPE_PRICE_DESK",
  terminal: "STRIPE_PRICE_TERMINAL",
};

export function isPaidPlan(plan: PlanId): plan is PaidPlan {
  return plan !== "observer";
}

export function priceFor(plan: PaidPlan): string | null {
  return process.env[PRICE_ENV[plan]] || null;
}

export function planForPrice(priceId: string): PlanId | null {
  for (const plan of Object.keys(PRICE_ENV) as PaidPlan[]) {
    if (priceFor(plan) === priceId) return plan;
  }
  return null;
}

/** Paid plans that have a price configured, so the page can hide the rest. */
export function purchasablePlans(): PaidPlan[] {
  return (Object.keys(PLANS) as PlanId[]).filter(isPaidPlan).filter((plan) => priceFor(plan) !== null);
}

export function appUrl(request: Request) {
  return process.env.APP_URL || new URL(request.url).origin;
}
