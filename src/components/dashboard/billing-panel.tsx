"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/plans";

const OPTIONS: Array<{ id: PlanId; name: string; price: string; detail: string }> = [
  { id: "observer", name: "Observer", price: "Free", detail: "3 wallets" },
  { id: "desk", name: "Desk", price: "$49 / month", detail: "25 wallets" },
  { id: "terminal", name: "Terminal", price: "$149 / month", detail: "Unlimited wallets" },
];

type Reply = { url?: string; message?: string; ok?: boolean; error?: { title?: string; body?: string } };

type CheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

export function BillingPanel({
  current,
  provider,
  email,
  purchasable,
  hasCustomer,
  subscribed,
  checkout,
  prices,
}: {
  current: PlanId;
  provider: "razorpay" | "stripe" | "none";
  email: string;
  purchasable: PlanId[];
  hasCustomer: boolean;
  subscribed: boolean;
  checkout: "success" | "cancelled" | null;
  prices: { desk: string; terminal: string; deskDetail: string; terminalDetail: string } | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(
    checkout === "success"
      ? "Payment received. Your desk updates as soon as the provider confirms it."
      : checkout === "cancelled"
        ? "Checkout was closed. Nothing was charged."
        : null,
  );
  const [pending, setPending] = useState<PlanId | "portal" | null>(null);

  const options = OPTIONS.map((option) => {
    if (!prices || option.id === "observer") return option;
    if (option.id === "desk") return { ...option, price: prices.desk, detail: prices.deskDetail };
    return { ...option, price: prices.terminal, detail: prices.terminalDetail };
  });

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as Reply;
    if (json.url) {
      window.location.assign(json.url);
      return;
    }
    setPending(null);
    setMessage(json.message ?? [json.error?.title, json.error?.body].filter(Boolean).join(" ") ?? null);
    if (response.ok) router.refresh();
  }

  async function pay(plan: Exclude<PlanId, "observer">) {
    setPending(plan);
    setMessage(null);
    const response = await fetch("/api/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const order = (await response.json().catch(() => ({}))) as Reply & {
      order_id?: string;
      amount?: number;
      currency?: string;
      key_id?: string;
    };
    if (!response.ok || !order.order_id || !order.key_id || !order.amount || !order.currency) {
      setPending(null);
      setMessage(order.error?.title ?? "We couldn't open checkout.");
      return;
    }

    try {
      await loadCheckout();
    } catch {
      setPending(null);
      setMessage("Razorpay's checkout couldn't be loaded.");
      return;
    }

    const Checkout = window.Razorpay;
    if (!Checkout) {
      setPending(null);
      setMessage("Razorpay's checkout couldn't be loaded.");
      return;
    }

    const instance = new Checkout({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: "Wallet Watch",
      description: plan === "desk" ? "Desk · 30 days" : "Terminal · 30 days",
      order_id: order.order_id,
      prefill: { email },
      theme: { color: "#161513" },
      handler: (result: CheckoutSuccess) => {
        void post("/api/verify-payment", result);
      },
      modal: {
        ondismiss: () => {
          setPending(null);
          setMessage("Checkout was closed. Nothing was charged.");
        },
      },
    });
    instance.on("payment.failed", (failed) => {
      setPending(null);
      setMessage(failed.error?.description ?? "The payment failed. Nothing was applied.");
    });
    instance.open();
  }

  function choose(plan: PlanId) {
    if (provider === "razorpay" && plan !== "observer") {
      void pay(plan);
      return;
    }
    setPending(plan);
    setMessage(null);
    void post("/api/billing", { plan });
  }

  function portal() {
    setPending("portal");
    setMessage(null);
    void post("/api/billing/portal");
  }

  const connected = provider !== "none";

  return (
    <div>
      <ul className="mt-12 border-t border-line">
        {options.map((option) => {
          const isCurrent = current === option.id;
          const available = option.id === "observer" || purchasable.includes(option.id);
          const label = isCurrent
            ? "Current"
            : pending === option.id
              ? "Opening"
              : !available
                ? "Not available"
                : subscribed
                  ? "Change"
                  : option.id === "observer"
                    ? "Choose"
                    : provider === "razorpay"
                      ? "Pay"
                      : connected
                        ? "Subscribe"
                        : "Choose";
          return (
            <li key={option.id} className="grid items-baseline gap-3 border-b border-line py-6 md:grid-cols-[1fr_160px_160px_auto]">
              <div>
                <p className="text-lg">{option.name}</p>
                {isCurrent ? <p className="mt-1 text-xs tracking-[0.14em] text-brass uppercase">Current</p> : null}
              </div>
              <p className="font-mono text-sm">{option.price}</p>
              <p className="text-sm text-muted">{option.detail}</p>
              <button
                type="button"
                disabled={pending !== null || isCurrent || !available}
                onClick={() => choose(option.id)}
                className="h-9 justify-self-start border border-line px-3 text-sm disabled:opacity-40 md:justify-self-end"
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <p className="max-w-lg text-sm text-faint">
          {message ??
            (provider === "razorpay"
              ? "Pay opens Razorpay checkout. A successful payment covers 30 days. It does not renew on its own."
              : provider === "stripe"
                ? subscribed
                  ? "Plan changes, cancellation, invoices, and the card on file are handled by Stripe."
                  : "Paid desks are billed monthly by Stripe. Cancel any time from this page."
                : "Billing isn't connected in this environment. Choosing a plan saves it on your account.")}
        </p>
        {provider === "stripe" && hasCustomer ? (
          <button
            type="button"
            disabled={pending !== null}
            onClick={portal}
            className="h-9 border border-line px-3 text-sm disabled:opacity-40"
          >
            {pending === "portal" ? "Opening" : "Manage billing"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("checkout.js failed"));
    document.body.appendChild(script);
  });
}
