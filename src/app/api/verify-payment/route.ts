import { getSessionUser } from "@/lib/auth/session";
import {
  PAID_PERIOD_MS,
  isPaidPlan,
  paiseFor,
  razorpay,
  razorpayConfigured,
  signaturesMatch,
} from "@/lib/billing/razorpay";
import { getStore } from "@/lib/store";

function fail(title: string, status: number) {
  return Response.json({ error: { title } }, { status });
}

/**
 * Confirms a Razorpay checkout. The plan changes only after the signature
 * matches and Razorpay itself says this payment captured this order.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Sign in to pay.", 401);
  if (!razorpayConfigured()) return fail("Billing isn't connected in this environment.", 503);

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return fail("Billing isn't connected in this environment.", 503);

  const body = (await request.json().catch(() => null)) as {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  } | null;

  const orderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!orderId || !paymentId || !signature) return fail("The payment confirmation is incomplete.", 400);
  if (!signaturesMatch(orderId, paymentId, signature, secret)) {
    return fail("The payment signature doesn't match. Nothing was applied.", 400);
  }

  try {
    const client = razorpay();
    const [order, payment] = await Promise.all([client.orders.fetch(orderId), client.payments.fetch(paymentId)]);
    const notes = order.notes && typeof order.notes === "object" ? order.notes : {};
    const plan = typeof notes.plan === "string" ? notes.plan : "";
    const owner = typeof notes.userId === "string" ? notes.userId : "";
    if (!isPaidPlan(plan) || owner !== user.id) return fail("This payment isn't for your account.", 400);
    if (payment.order_id !== orderId) return fail("This payment isn't for that order.", 400);
    if (Number(order.amount) !== paiseFor(plan) || Number(payment.amount) !== paiseFor(plan)) {
      return fail("The amount paid doesn't match this desk.", 400);
    }
    if (payment.status !== "captured" && payment.status !== "authorized") {
      return fail("Razorpay has not captured this payment.", 400);
    }

    const store = await getStore();
    await store.setBilling(user.id, {
      customerId: orderId,
      subscriptionId: paymentId,
      status: "paid",
      periodEnd: Date.now() + PAID_PERIOD_MS,
      cancelAtPeriodEnd: false,
    });
    const updated = await store.setPlan(user.id, plan);
    return Response.json({
      ok: true,
      user: updated,
      message: `${updated.plan === "desk" ? "Desk" : "Terminal"} is active for 30 days.`,
    });
  } catch (error) {
    console.error("[billing] Razorpay verify failed:", error instanceof Error ? error.message : error);
    return fail("We couldn't confirm the payment with Razorpay.", 500);
  }
}
