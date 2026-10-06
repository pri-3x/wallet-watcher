export type TelegramChat = {
  id: string;
  label: string;
};

type Update = {
  message?: { chat?: { id?: number; title?: string; username?: string; first_name?: string } };
};

/** Keeps the latest message from each chat. Telegram returns oldest first. */
export function chatsFromUpdates(updates: Update[]): TelegramChat[] {
  const chats = new Map<string, string>();
  for (const update of updates) {
    const chat = update.message?.chat;
    if (!chat || chat.id === undefined) continue;
    const label = chat.title || (chat.username ? `@${chat.username}` : chat.first_name) || String(chat.id);
    chats.set(String(chat.id), label);
  }
  return [...chats.entries()].map(([id, label]) => ({ id, label }));
}

export async function telegramIdentity(): Promise<{ username: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const json = (await response.json()) as { ok?: boolean; result?: { username?: string } };
  const username = json.result?.username;
  return json.ok && username ? { username } : null;
}

/** A numeric id is used as-is. A @username matches a chat that has already messaged the bot. */
export function chatIdFor(target: string, chats: TelegramChat[]): string | null {
  const trimmed = target.trim();
  if (/^-?\d+$/.test(trimmed)) return trimmed;
  const name = trimmed.replace(/^@/, "").toLowerCase();
  if (!name) return null;
  const match = chats.find((chat) => chat.label.replace(/^@/, "").toLowerCase() === name);
  return match?.id ?? null;
}

export async function recentTelegramChats(): Promise<TelegramChat[]> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [];
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(await response.text());
  const json = (await response.json()) as { ok?: boolean; result?: Update[] };
  if (!json.ok) return [];
  return chatsFromUpdates(json.result ?? []);
}
