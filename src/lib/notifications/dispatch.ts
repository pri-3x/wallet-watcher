import { shortAddress } from "@/lib/address";
import { getStore } from "@/lib/store";
import type { ChannelType, StoredNotification } from "@/lib/store/types";

const TIMEOUT_MS = 8000;

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
      note: process.env.RESEND_API_KEY ? `Sends from ${fromAddress()}` : "Set RESEND_API_KEY to send email.",
    },
    {
      channel: "telegram",
      label: "Telegram",
      ready: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      note: process.env.TELEGRAM_BOT_TOKEN ? "Bot token set." : "Set TELEGRAM_BOT_TOKEN to send messages.",
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
        await store.markNotification(note.id, "failed", message.slice(0, 500));
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
        subject: "A watched wallet moved",
        text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(await response.text());
    return;
  }

  if (note.channel === "telegram") {
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("UNCONFIGURED");
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: note.target, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(await response.text());
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

function fromAddress() {
  return process.env.EMAIL_FROM || "Wallet Watch <alerts@walletwatch.dev>";
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
