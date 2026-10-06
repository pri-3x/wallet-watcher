"use client";

import { useState } from "react";
import type { ChannelType } from "@/lib/store/types";

const PLACEHOLDER: Record<ChannelType, string> = {
  email: "you@domain.com",
  telegram: "@you, after you message the bot",
  discord: "https://discord.com/api/webhooks/…",
  webhook: "https://",
};

export function DeliveryTest({ channels, defaultEmail }: { channels: ChannelType[]; defaultEmail: string }) {
  const [channel, setChannel] = useState<ChannelType>(channels[0] ?? "webhook");
  const [target, setTarget] = useState(channel === "email" ? defaultEmail : "");
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [chats, setChats] = useState<Array<{ id: string; label: string }>>([]);

  function pick(next: ChannelType) {
    setChannel(next);
    setTarget(next === "email" ? defaultEmail : "");
    setChats([]);
    setState(null);
  }

  async function findChats() {
    setPending(true);
    setState(null);
    const response = await fetch("/api/notifications/telegram");
    const json = (await response.json()) as {
      chats?: Array<{ id: string; label: string }>;
      error?: { title?: string };
    };
    setPending(false);
    if (!response.ok) {
      setState({ tone: "error", text: json.error?.title ?? "Telegram didn't answer." });
      return;
    }
    setChats(json.chats ?? []);
    if ((json.chats ?? []).length === 0) {
      setState({ tone: "error", text: "No chats yet. Message the bot, then look again." });
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setState(null);
    const response = await fetch("/api/notifications/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, target }),
    });
    const json = (await response.json()) as { message?: string; error?: { title?: string; body?: string } };
    setPending(false);
    if (response.ok) {
      setState({ tone: "ok", text: json.message ?? "Sent." });
    } else {
      setState({ tone: "error", text: [json.error?.title, json.error?.body].filter(Boolean).join(" ") });
    }
  }

  return (
    <form onSubmit={send} className="mt-6">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {channels.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => pick(item)}
            className={item === channel ? "border-b border-ink pb-0.5" : "text-muted hover:text-ink"}
          >
            {label(item)}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder={PLACEHOLDER[channel]}
          className="h-10 flex-1 border border-line bg-transparent px-3 font-mono text-sm outline-none focus:border-line-strong"
        />
        <button
          type="submit"
          disabled={pending || !target.trim()}
          className="h-10 border border-line px-4 text-sm disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send a test"}
        </button>
      </div>
      {channel === "telegram" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void findChats()} disabled={pending} className="text-sm text-muted hover:text-ink">
            Find chats
          </button>
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => setTarget(chat.id)}
              className={target === chat.id ? "text-sm text-ink" : "text-sm text-faint hover:text-ink"}
            >
              {chat.label}
            </button>
          ))}
        </div>
      ) : null}
      {state ? (
        <p className={`mt-3 text-sm ${state.tone === "ok" ? "text-inflow" : "text-outflow"}`}>{state.text}</p>
      ) : null}
    </form>
  );
}

function label(channel: ChannelType) {
  if (channel === "email") return "Email";
  if (channel === "telegram") return "Telegram";
  if (channel === "discord") return "Discord";
  return "Webhook";
}
