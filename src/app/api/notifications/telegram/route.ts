import { getSessionUser } from "@/lib/auth/session";
import { recentTelegramChats } from "@/lib/notifications/telegram";

/** Chats that have messaged the bot. The user picks one instead of looking up an id. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { title: "Sign in first." } }, { status: 401 });
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ error: { title: "Telegram isn't connected." } }, { status: 503 });
  }
  try {
    const chats = await recentTelegramChats();
    return Response.json({ chats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram didn't answer.";
    return Response.json({ error: { title: "Telegram didn't answer.", body: message.slice(0, 200) } }, { status: 502 });
  }
}
