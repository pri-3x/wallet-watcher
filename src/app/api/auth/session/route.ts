import { z } from "zod";
import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { ensureDemoDesk } from "@/lib/demo/desk";
import { DEMO_EMAIL } from "@/lib/parties";
import { getStore } from "@/lib/store";

const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("demo") }),
  z.object({ mode: z.literal("signin"), email: z.email(), password }),
  z.object({ mode: z.literal("signup"), email: z.email(), password }),
]);

const WRONG = { error: { title: "That email and password don't match." } };

function fail(title: string, status: number) {
  return Response.json({ error: { title } }, { status });
}

export async function GET() {
  const user = await getSessionUser();
  return Response.json({ user });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "password") {
      return fail(`Use a password of ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`, 400);
    }
    return fail("That email doesn't look right.", 400);
  }
  const body = parsed.data;
  const store = await getStore();

  // The demo desk is shared and read-only in spirit. It has no password.
  if (body.mode === "demo") {
    const user = await store.upsertUser(DEMO_EMAIL);
    await ensureDemoDesk(user.id);
    await setSessionCookie(user);
    return Response.json({ user });
  }

  const email = body.email.toLowerCase();
  if (email === DEMO_EMAIL) return fail("Use the demo button for the demo desk.", 400);

  if (body.mode === "signin") {
    const user = await store.getUserByEmail(email);
    const stored = user ? await store.getPasswordHash(user.id) : null;
    if (!user || !stored) return Response.json(WRONG, { status: 401 });
    if (!(await verifyPassword(body.password, stored))) return Response.json(WRONG, { status: 401 });
    await setSessionCookie(user);
    return Response.json({ user });
  }

  // signup. An account that exists with a password stays with its owner.
  // One without a password was created before passwords existed and is claimed here.
  const existing = await store.getUserByEmail(email);
  if (existing && (await store.getPasswordHash(existing.id))) {
    return fail("That email already has an account. Sign in instead.", 409);
  }
  const user = existing ?? (await store.upsertUser(email));
  await store.setPasswordHash(user.id, await hashPassword(body.password));
  await setSessionCookie(user);
  return Response.json({ user });
}

export async function DELETE() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
