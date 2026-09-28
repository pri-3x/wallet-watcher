import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import type { PlanId } from "@/lib/plans";

/** Paid desks. Amounts are paise. Razorpay's minimum is 100. */
export const PLAN_PAISE = {
  desk: 490_000,
  terminal: 1_490_000,
} as const;

export const PLAN_LABEL = {
  desk: { name: "Desk", price: "₹4,900", detail: "25 wallets · 30 days" },
  terminal: { name: "Terminal", price: "₹14,900", detail: "Unlimited wallets · 30 days" },
} as const;

export const PAID_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type PaidPlan = keyof typeof PLAN_PAISE;

let client: Razorpay | undefined;

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId() {
  const key = process.env.RAZORPAY_KEY_ID;
  if (!key) throw new Error("RAZORPAY_KEY_ID is unset");
  return key;
}

export function razorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay keys are unset");
  client ??= new Razorpay({ key_id, key_secret });
  return client;
}

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === "desk" || plan === "terminal";
}

export function paiseFor(plan: PaidPlan) {
  return PLAN_PAISE[plan];
}

/**
 * Razorpay signs `order_id|payment_id` with the key secret.
 * A mismatch means the browser did not pay this order.
 */
export function signaturesMatch(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function planFromNotes(notes: Record<string, string> | undefined): PlanId | null {
  const plan = notes?.plan;
  return plan && isPaidPlan(plan) ? plan : null;
}
