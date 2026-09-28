import { z } from "zod";
import { COOLDOWN_15_MIN, COOLDOWN_1_HOUR, COOLDOWN_IMMEDIATE } from "@/lib/alerts/quiet";
import { getSessionUser } from "@/lib/auth/session";
import { getStore, StoreError } from "@/lib/store";

const schema = z.object({
  cooldownMs: z.union([z.literal(COOLDOWN_IMMEDIATE), z.literal(COOLDOWN_15_MIN), z.literal(COOLDOWN_1_HOUR)]),
});

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to change watches." } }, { status: 401 });
  const { id } = await context.params;
  const store = await getStore();
  await store.deleteWatch(user.id, id);
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to change watches." } }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { title: "Choose immediate, 15 minutes, or 1 hour." } }, { status: 400 });
  }
  const { id } = await context.params;
  const store = await getStore();
  try {
    const watch = await store.setCooldown(user.id, id, parsed.data.cooldownMs);
    return Response.json({ watch });
  } catch (error) {
    const message = error instanceof StoreError ? error.message : "We couldn't update that watch.";
    return Response.json({ error: { title: message } }, { status: 404 });
  }
}
