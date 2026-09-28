"use client";

import { useState } from "react";
import type { ChannelType } from "@/lib/store/types";

const PLACEHOLDER: Record<ChannelType, string> = {
  email: "you@domain.com",
  telegram: "Chat ID",
  discord: "https://discord.com/api/webhooks/…",
  webhook: "https://",
};

export function DeliveryTest({ channels, defaultEmail }: { channels: ChannelType[]; defaultEmail: string }) {
  const [channel, setChannel] = useState<ChannelType>(channels[0] ?? "webhook");
  const [target, setTarget] = useState(channel === "email" ? defaultEmail : "");
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  function pick(next: ChannelType) {
    setChannel(next);
    setTarget(next === "email" ? defaultEmail : "");
    setState(null);
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
