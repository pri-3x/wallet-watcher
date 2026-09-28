import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to see alerts." } }, { status: 401 });
  const store = await getStore();
  const alerts = await store.listAlertEvents(user.id);
  return Response.json({ alerts });
}
