import { shortAddress } from "@/lib/address";
import { emailHtml, emailSubject, emailText, parseSignal } from "@/lib/notifications/email";
import { chatIdFor, recentTelegramChats } from "@/lib/notifications/telegram";
import { getStore } from "@/lib/store";
import type { ChannelType, StoredNotification } from "@/lib/store/types";

const TIMEOUT_MS = 8000;
export const MAX_DELIVERY_ATTEMPTS = 3;
const BACKOFF_MS = [30_000, 120_000];

/** Wait after a failed attempt before it is eligible again. Attempt 1 waits 30s, attempt 2 waits 2 minutes. */
export function retryDelay(attempt: number) {
  return BACKOFF_MS[Math.max(0, Math.min(attempt, BACKOFF_MS.length) - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
}

export type ProviderState = {
  channel: ChannelType;
  label: string;
  ready: boolean;
  note: string;
};

/** Which channels can actually send in this environment. */
export function providerStates(): ProviderState[] {
  return [
    {
      channel: "email",
      label: "Email",
      ready: Boolean(process.env.RESEND_API_KEY),
      note: process.env.RESEND_API_KEY
        ? process.env.EMAIL_FROM
          ? `Sends from ${fromAddress()}`
          : "Test sender. Delivers only to your Resend account email until a domain is verified."
        : "Set RESEND_API_KEY to send email.",
    },
    {
      channel: "telegram",
      label: "Telegram",
      ready: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      note: process.env.TELEGRAM_BOT_TOKEN
        ? "Bot token set. Message the bot, then send a test from here."
        : "Create a bot with @BotFather and set TELEGRAM_BOT_TOKEN.",
    },
    { channel: "discord", label: "Discord", ready: true, note: "Posts to a channel webhook URL." },
    { channel: "webhook", label: "Webhook", ready: true, note: "POSTs JSON to any https URL." },
  ];
}

export async function dispatchPending() {
  const store = await getStore();
  const pending = await store.claimPendingNotifications(20);
  for (const note of pending) {
    try {
      await deliver(note);
      await store.markNotification(note.id, "delivered");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery failed";
      if (message === "UNCONFIGURED") {
        await store.markNotification(note.id, "logged", "No delivery provider configured.");
      } else {
        const attempts = (note.attempts ?? 0) + 1;
        const reason = message.slice(0, 500);
        if (attempts >= MAX_DELIVERY_ATTEMPTS) {
          await store.markNotification(note.id, "failed", reason, { attempts, nextAttemptAt: Date.now() });
        } else {
          await store.markNotification(note.id, "retry", reason, {
            attempts,
            nextAttemptAt: Date.now() + retryDelay(attempts),
          });
        }
      }
    }
  }
  return pending.length;
}

/**
 * Send one notification. Throws "UNCONFIGURED" when the channel has no
 * provider in this environment, and the provider's error text otherwise.
 */
export async function deliver(note: Pick<StoredNotification, "channel" | "target" | "payload">) {
  const text = `Wallet Watch\n${note.payload}`;

  if (note.channel === "email") {
    if (!process.env.RESEND_API_KEY) throw new Error("UNCONFIGURED");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: note.target,
        subject: emailSubject(parseSignal(note.payload)),
        text: emailText(parseSignal(note.payload)),
        html: emailHtml(parseSignal(note.payload)),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(await explainFailure("email", await response.text()));
    return;
  }

  if (note.channel === "telegram") {
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("UNCONFIGURED");
    const chatId = await resolveTelegramChat(note.target);
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(await explainFailure("telegram", await response.text()));
    return;
  }

  if (note.channel === "discord" || note.channel === "webhook") {
    if (!isHttpUrl(note.target)) throw new Error("Destination must be an http(s) URL.");
    const response = await fetch(note.target, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "wallet-watch" },
      body: JSON.stringify(
        note.channel === "discord"
          ? { content: text }
          : { source: "wallet-watch", text: note.payload, sentAt: new Date().toISOString() },
      ),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`.trim());
    return;
  }

  throw new Error("UNCONFIGURED");
}

export function notificationText(address: string, detail: string, link?: string) {
  const line = `${shortAddress(address)} · ${detail}`;
  return link ? `${line}\n${link}` : line;
}

/**
 * Resend's shared test sender works without a verified domain, but only
 * delivers to the account owner's own address. Set EMAIL_FROM to an address on
 * a verified domain to email anyone.
 */
async function resolveTelegramChat(target: string) {
  const chats = await recentTelegramChats();
  const chatId = chatIdFor(target, chats);
  if (chatId) return chatId;
  throw new Error("Message the bot once from that account, then use Find chats. A username isn't a chat until the bot has seen it.");
}

/** Turns a provider's JSON into a sentence. The raw body is not shown. */
export async function explainFailure(channel: "email" | "telegram", raw: string) {
  let description = raw;
  try {
    const json = JSON.parse(raw) as { message?: string; description?: string };
    description = json.message || json.description || raw;
  } catch {
    description = raw;
  }
  if (channel === "email" && /only send testing emails/i.test(description)) {
    const allowed = description.match(/\(([^)]+@[^)]+)\)/)?.[1];
    return allowed
      ? `Resend's test sender can only email ${allowed}. Verify a domain to reach anyone else.`
      : "Resend's test sender can only email the address on your Resend account.";
  }
  if (channel === "telegram" && /chat not found/i.test(description)) {
    return "Message the bot once from that account, then use Find chats. A username isn't a chat until the bot has seen it.";
  }
  return description.slice(0, 300);
}

function fromAddress() {
  return process.env.EMAIL_FROM || "Wallet Watch <onboarding@resend.dev>";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    // Plain http is allowed for local receivers only.
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}
