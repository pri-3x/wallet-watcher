import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getStore } from "@/lib/store";
import type { StoreUser } from "@/lib/store/types";

const COOKIE = "ww_session";

type SessionPayload = {
  id: string;
  email: string;
  exp: number;
};

function secret() {
  return process.env.SESSION_SECRET || "wallet-watch-dev-secret";
}

export function signSession(user: Pick<StoreUser, "id" | "email">) {
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSession(token: string): SessionPayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (!data.id || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = readSession(token);
  if (!session) return null;
  const store = await getStore();
  return store.getUserById(session.id);
}

export async function setSessionCookie(user: Pick<StoreUser, "id" | "email">) {
  const jar = await cookies();
  jar.set(COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
