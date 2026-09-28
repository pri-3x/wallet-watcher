import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to change watches." } }, { status: 401 });
  const { id } = await context.params;
  const store = await getStore();
  await store.deleteWatch(user.id, id);
  return Response.json({ ok: true });
}
