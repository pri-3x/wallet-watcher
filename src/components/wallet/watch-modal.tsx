"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addressOk, findChain } from "@/lib/chains/catalog";
import { COOLDOWN_OPTIONS, DEFAULT_COOLDOWN_MS } from "@/lib/alerts/quiet";
import { formatUsd } from "@/lib/format";
import type { RuleType } from "@/lib/alerts/engine";
import type { ChannelType } from "@/lib/store/types";

const RULES: Array<{ id: RuleType; label: string }> = [
  { id: "ANY", label: "Any transaction" },
  { id: "TRANSFER", label: "Transfer exceeds threshold" },
  { id: "ETH", label: "ETH moves" },
  { id: "STABLECOIN", label: "Stablecoins move" },
  { id: "DEX", label: "Wallet interacts with a DEX" },
  { id: "NEW_CONTRACT", label: "Wallet interacts with a new contract" },
];

const THRESHOLDS = [10_000, 50_000, 100_000];
const CHANNELS: Array<{ id: ChannelType; label: string; placeholder: string }> = [
  { id: "email", label: "Email", placeholder: "you@domain.com" },
  { id: "telegram", label: "Telegram", placeholder: "Chat ID" },
  { id: "discord", label: "Discord", placeholder: "https://discord.com/api/webhooks/…" },
  { id: "webhook", label: "Webhook", placeholder: "https://" },
];

export function WatchWalletModal({
  open,
  address,
  chain,
  onClose,
}: {
  open: boolean;
  address?: string;
  chain: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [wallet, setWallet] = useState(address ?? "");
  const [selected, setSelected] = useState<RuleType[]>(["TRANSFER"]);
  const [threshold, setThreshold] = useState(10_000);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [channels, setChannels] = useState<ChannelType[]>(["email"]);
  const [cooldownMs, setCooldownMs] = useState(DEFAULT_COOLDOWN_MS);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then((json: { user?: { email?: string } | null }) => {
        if (json.user?.email) {
          setSignedIn(true);
          setEmail(json.user.email);
          setTargets((current) => ({ ...current, email: json.user?.email ?? "" }));
        }
      })
      .catch(() => undefined);
  }, [open, address]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const amount = useCustom ? Number(custom.replace(/[$,\s]/g, "")) : threshold;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const chainDef = findChain(chain);
    if (!chainDef || !addressOk(chainDef.id, wallet)) {
      setError(
        chainDef?.family === "solana"
          ? "That doesn't look like a Solana address."
          : "That doesn't look like a wallet address.",
      );
      return;
    }
    if (selected.length === 0) {
      setError("Choose at least one condition.");
      return;
    }
    if (channels.length === 0) {
      setError("Choose where to send the signal.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a threshold above zero.");
      return;
    }
    for (const channel of channels) {
      if (!targets[channel]?.trim()) {
        setError(`Add a destination for ${channel}.`);
        return;
      }
    }

    setPending(true);
    if (!signedIn) {
      const auth = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email || targets.email }),
      });
      if (!auth.ok) {
        const json = (await auth.json()) as { error?: { title?: string } };
        setPending(false);
        setError(json.error?.title ?? "We couldn't start a session.");
        return;
      }
      setSignedIn(true);
    }

    const response = await fetch("/api/watches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: wallet,
        chain,
        rules: selected.map((eventType) => ({
          eventType,
          threshold: eventType === "TRANSFER" ? amount : undefined,
          direction: "ANY",
        })),
        channels: channels.map((type) => ({ type, target: targets[type] })),
        cooldownMs,
      }),
    });
    const json = (await response.json()) as { error?: { title?: string; body?: string } };
    setPending(false);
    if (!response.ok) {
      setError(json.error?.body ?? json.error?.title ?? "We couldn't watch this wallet.");
      return;
    }
    onClose();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-ink/30"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            onSubmit={submit}
            role="dialog"
            aria-labelledby="watch-title"
            className="fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[min(480px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto border border-line bg-canvas p-7"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <p className="eyebrow">Monitor</p>
            <h2 id="watch-title" className="mt-3 text-4xl tracking-tight">
              Watch this wallet
            </h2>
            {!address ? (
              <input
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="0x…"
                className="mt-6 w-full border border-line bg-transparent px-3 py-2 font-mono text-sm outline-none"
              />
            ) : (
              <p className="mt-4 font-mono text-sm text-muted">
                {wallet}
                <span className="text-faint"> · {findChain(chain)?.name}</span>
              </p>
            )}

            {!signedIn ? (
              <label className="mt-6 block text-sm">
                <span className="eyebrow">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setTargets((current) => ({ ...current, email: event.target.value }));
                  }}
                  placeholder="you@domain.com"
                  className="mt-2 w-full border border-line bg-transparent px-3 py-2 outline-none"
                />
              </label>
            ) : null}

            <fieldset className="mt-8">
              <legend className="text-sm text-muted">Notify me when</legend>
              <div className="mt-3 border-t border-line">
                {RULES.map((rule) => {
                  const checked = selected.includes(rule.id);
                  return (
                    <label key={rule.id} className="flex cursor-pointer items-center gap-3 border-b border-line py-3 text-sm">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(rule.id) ? current.filter((item) => item !== rule.id) : [...current, rule.id],
                          )
                        }
                      />
                      <span className={`grid h-4 w-4 place-items-center border ${checked ? "border-ink bg-ink text-canvas" : "border-line"}`}>
                        {checked ? "✓" : ""}
                      </span>
                      {rule.id === "TRANSFER"
                        ? `Transfer exceeds ${formatUsd(amount || 0)}`
                        : rule.id === "ETH"
                          ? `${findChain(chain)?.nativeSymbol ?? "ETH"} moves`
                          : rule.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6">
              <p className="text-sm text-muted">Threshold</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {THRESHOLDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setUseCustom(false);
                      setThreshold(value);
                    }}
                    className={`h-9 border px-3 font-mono text-xs ${
                      !useCustom && threshold === value ? "border-ink text-ink" : "border-line text-muted"
                    }`}
                  >
                    {formatUsd(value)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUseCustom(true)}
                  className={`h-9 border px-3 text-xs ${useCustom ? "border-ink" : "border-line text-muted"}`}
                >
                  Custom
                </button>
              </div>
              {useCustom ? (
                <input
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                  placeholder="25000"
                  className="mt-3 w-full border border-line bg-transparent px-3 py-2 font-mono text-sm outline-none"
                />
              ) : null}
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm text-muted">Channels</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {CHANNELS.map((channel) => {
                  const on = channels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() =>
                        setChannels((current) =>
                          current.includes(channel.id)
                            ? current.filter((item) => item !== channel.id)
                            : [...current, channel.id],
                        )
                      }
                      className={`h-9 border px-3 text-sm ${on ? "border-ink" : "border-line text-muted"}`}
                    >
                      {channel.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 space-y-2">
                {channels.map((channel) => {
                  const meta = CHANNELS.find((item) => item.id === channel);
                  return (
                    <input
                      key={channel}
                      value={targets[channel] ?? ""}
                      onChange={(event) => setTargets((current) => ({ ...current, [channel]: event.target.value }))}
                      placeholder={meta?.placeholder}
                      className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none"
                    />
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6">
              <p className="text-sm text-muted">Quiet period</p>
              <p className="mt-2 text-sm text-faint">The first match sends at once. Further matches stay on the timeline.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {COOLDOWN_OPTIONS.map((option) => (
                  <button
                    key={option.ms}
                    type="button"
                    onClick={() => setCooldownMs(option.ms)}
                    className={`h-9 border px-3 text-xs ${cooldownMs === option.ms ? "border-ink text-ink" : "border-line text-muted"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-outflow">{error}</p> : null}

            <div className="mt-8 flex items-center justify-between">
              <button type="button" onClick={onClose} className="text-sm text-muted">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="h-10 bg-ink px-4 text-sm text-canvas disabled:opacity-60">
                {pending ? "Saving" : "Start watching"}
              </button>
            </div>
          </motion.form>
        </>
      ) : null}
    </AnimatePresence>
  );
}
