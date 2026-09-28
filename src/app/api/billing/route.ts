import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isPlanId } from "@/lib/plans";
import { getStore } from "@/lib/store";

const schema = z.object({
  plan: z.string(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to change plans." } }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPlanId(parsed.data.plan)) {
    return Response.json({ error: { title: "That plan isn't available." } }, { status: 400 });
  }
  const store = await getStore();
  const updated = await store.setPlan(user.id, parsed.data.plan);
  return Response.json({
    user: updated,
    connected: false,
    message: "Billing isn't connected in this environment. Your plan is saved on this account.",
  });
}
