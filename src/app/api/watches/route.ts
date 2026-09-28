import { z } from "zod";
import { isAddress } from "@/lib/address";
import { COOLDOWN_15_MIN, COOLDOWN_1_HOUR, COOLDOWN_IMMEDIATE, DEFAULT_COOLDOWN_MS } from "@/lib/alerts/quiet";
import { getSessionUser } from "@/lib/auth/session";
import { indexWatches } from "@/lib/indexer";
import { canonicalAddress } from "@/lib/parties";
import { PLANS } from "@/lib/plans";
import { getStore, StoreError } from "@/lib/store";

const cooldownSchema = z.union([
  z.literal(COOLDOWN_IMMEDIATE),
  z.literal(COOLDOWN_15_MIN),
  z.literal(COOLDOWN_1_HOUR),
]);

const schema = z.object({
  address: z.string(),
  rules: z
    .array(
      z.object({
        eventType: z.enum(["ANY", "TRANSFER", "ETH", "STABLECOIN", "DEX", "NEW_CONTRACT"]),
        threshold: z.number().positive().optional(),
        direction: z.enum(["INCOMING", "OUTGOING", "ANY"]).optional(),
      }),
    )
    .min(1),
  channels: z
    .array(
      z.object({
        type: z.enum(["email", "telegram", "discord", "webhook"]),
        target: z.string().min(1),
      }),
    )
    .min(1),
  cooldownMs: cooldownSchema.optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to see your watches." } }, { status: 401 });
  const store = await getStore();
  const watches = await store.listWatches(user.id);
  return Response.json({ watches });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { error: { title: "Sign in to watch a wallet.", body: "Add an email and try again." } },
      { status: 401 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isAddress(parsed.data?.address ?? "")) {
    return Response.json({ error: { title: "That address doesn't look right." } }, { status: 400 });
  }

  const store = await getStore();
  const existing = await store.listWatches(user.id);
  const limit = PLANS[user.plan].walletLimit;
  if (existing.length >= limit) {
    return Response.json(
      {
        error: {
          title: "This plan is full.",
          body: `${PLANS[user.plan].name} watches ${limit} wallets. Move to a larger desk to add more.`,
        },
      },
      { status: 402 },
    );
  }

  try {
    const watch = await store.createWatch({
      userId: user.id,
      address: canonicalAddress(parsed.data.address),
      rules: parsed.data.rules,
      channels: parsed.data.channels,
      cooldownMs: parsed.data.cooldownMs ?? DEFAULT_COOLDOWN_MS,
    });
    await indexWatches({ notify: false, userId: user.id });
    return Response.json({ watch });
  } catch (error) {
    const message = error instanceof StoreError ? error.message : "We couldn't watch this wallet.";
    return Response.json({ error: { title: message } }, { status: 400 });
  }
}
