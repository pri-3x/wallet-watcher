"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/plans";

const OPTIONS: Array<{ id: PlanId; name: string; price: string; detail: string }> = [
  { id: "observer", name: "Observer", price: "Free", detail: "3 wallets" },
  { id: "desk", name: "Desk", price: "$49 / month", detail: "25 wallets" },
  { id: "terminal", name: "Terminal", price: "$149 / month", detail: "Unlimited wallets" },
];

export function BillingPanel({ current }: { current: PlanId }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PlanId | null>(null);

  async function choose(plan: PlanId) {
    setPending(plan);
    const response = await fetch("/api/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const json = (await response.json()) as { message?: string; error?: { title?: string } };
    setPending(null);
    setMessage(json.message ?? json.error?.title ?? null);
    router.refresh();
  }

  return (
    <div>
      <ul className="mt-12 border-t border-line">
        {OPTIONS.map((option) => (
          <li key={option.id} className="grid items-baseline gap-3 border-b border-line py-6 md:grid-cols-[1fr_160px_160px_auto]">
            <div>
              <p className="text-lg">{option.name}</p>
              {current === option.id ? <p className="mt-1 text-xs tracking-[0.14em] text-brass uppercase">Current</p> : null}
            </div>
            <p className="font-mono text-sm">{option.price}</p>
            <p className="text-sm text-muted">{option.detail}</p>
            <button
              type="button"
              disabled={pending !== null || current === option.id}
              onClick={() => void choose(option.id)}
              className="h-9 justify-self-start border border-line px-3 text-sm disabled:opacity-40 md:justify-self-end"
            >
              {current === option.id ? "Selected" : pending === option.id ? "Saving" : "Choose"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-lg text-sm text-faint">
        {message ?? "Billing isn't connected in this environment. Choosing a plan saves it on your account."}
      </p>
    </div>
  );
}
