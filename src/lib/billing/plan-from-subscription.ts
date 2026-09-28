import type { PlanId } from "@/lib/plans";
import type { BillingRecord } from "@/lib/store/types";

/** The parts of a Stripe subscription this app reads. Kept narrow so it can be tested without the SDK. */
export type SubscriptionShape = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  customer: string | { id: string };
  items: { data: Array<{ price: { id: string }; current_period_end?: number | null }> };
};

/** Statuses that keep the paid plan on. past_due keeps access while Stripe retries the card. */
const LIVE = new Set(["active", "trialing", "past_due"]);

export type PlanChange = { plan: PlanId; billing: Partial<BillingRecord> };

/**
 * Reads a subscription and decides what the account's plan should be.
 * An unknown price, or a subscription that is not live, means Observer.
 */
export function planFromSubscription(
  subscription: SubscriptionShape,
  priceToPlan: (priceId: string) => PlanId | null,
): PlanChange {
  const item = subscription.items.data[0];
  const paid = item ? priceToPlan(item.price.id) : null;
  const live = LIVE.has(subscription.status);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const periodEnd = item?.current_period_end ? item.current_period_end * 1000 : null;

  if (!live || !paid) {
    return {
      plan: "observer",
      billing: {
        customerId,
        subscriptionId: subscription.status === "canceled" ? null : subscription.id,
        status: subscription.status,
        periodEnd: subscription.status === "canceled" ? null : periodEnd,
        cancelAtPeriodEnd: false,
      },
    };
  }

  return {
    plan: paid,
    billing: {
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status,
      periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  };
}
