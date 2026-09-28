import { z } from "zod";
import { clearSessionCookie, getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { ensureDemoDesk } from "@/lib/demo/desk";
import { DEMO_EMAIL } from "@/lib/parties";
import { getStore } from "@/lib/store";

const bodySchema = z.object({
  email: z.email(),
});

export async function GET() {
  const user = await getSessionUser();
  return Response.json({ user });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { title: "That email doesn't look right." } }, { status: 400 });
  }
  const store = await getStore();
  const user = await store.upsertUser(parsed.data.email);
  if (user.email === DEMO_EMAIL) await ensureDemoDesk(user.id);
  await setSessionCookie(user);
  return Response.json({ user });
}

export async function DELETE() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
