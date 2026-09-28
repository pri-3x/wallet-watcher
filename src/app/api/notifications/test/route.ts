import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { activeNetwork } from "@/lib/chains/ethereum";
import { deliver, notificationText } from "@/lib/notifications/dispatch";
import { DEMO_ADDRESS } from "@/lib/parties";

const schema = z.object({
  channel: z.enum(["email", "telegram", "discord", "webhook"]),
  target: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in to send a test." } }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { title: "Choose a channel and a destination." } }, { status: 400 });
  }

  const payload = notificationText(
    DEMO_ADDRESS,
    "Test signal. Delivery is working.",
    `${activeNetwork().explorer}/address/${DEMO_ADDRESS}`,
  );

  try {
    await deliver({ channel: parsed.data.channel, target: parsed.data.target, payload });
    return Response.json({ ok: true, message: `Sent to ${parsed.data.target}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery failed.";
    if (message === "UNCONFIGURED") {
      return Response.json(
        { error: { title: "This channel has no provider here.", body: "Add the provider key to the environment." } },
        { status: 503 },
      );
    }
    return Response.json({ error: { title: "The destination rejected it.", body: message.slice(0, 300) } }, { status: 502 });
  }
}
