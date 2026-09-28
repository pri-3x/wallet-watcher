import { getSessionUser } from "@/lib/auth/session";
import { isPaidPlan, paiseFor, razorpay, razorpayConfigured, razorpayKeyId } from "@/lib/billing/razorpay";

const MIN_PAISE = 100;

function fail(title: string, status: number) {
  return Response.json({ error: { title } }, { status });
}

/**
 * Creates a Razorpay order for a paid desk. The amount is decided here.
 * The browser cannot name its own price.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Sign in to pay.", 401);
  if (!razorpayConfigured()) return fail("Billing isn't connected in this environment.", 503);

  const body = (await request.json().catch(() => null)) as { plan?: unknown; amount?: unknown } | null;
  const plan = typeof body?.plan === "string" ? body.plan : "";
  if (!isPaidPlan(plan)) return fail("That plan isn't available.", 400);

  const amount = paiseFor(plan);
  if (!Number.isInteger(amount) || amount < MIN_PAISE) return fail("That amount is below the minimum.", 400);
  if (body?.amount !== undefined && body.amount !== amount) return fail("The amount doesn't match this desk.", 400);

  const receipt = `ww_${user.id.replace(/[^a-z0-9]/gi, "").slice(-12)}_${Date.now().toString(36)}`.slice(0, 40);

  try {
    const order = await razorpay().orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: { userId: user.id, plan },
    });
    return Response.json({
      order_id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      key_id: razorpayKeyId(),
    });
  } catch (error) {
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 0;
    const description =
      error && typeof error === "object" && "error" in error
        ? String((error as { error?: { description?: string } }).error?.description ?? "")
        : error instanceof Error
          ? error.message
          : "";
    console.error("[billing] Razorpay order failed:", description || error);
    if (statusCode === 401) return fail("Razorpay rejected the API keys.", 401);
    return fail("Razorpay couldn't open an order.", 500);
  }
}
