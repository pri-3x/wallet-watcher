"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_EMAIL } from "@/lib/parties";

export function SignInPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(value: string) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: value }),
    });
    setPending(false);
    if (!response.ok) {
      const json = (await response.json()) as { error?: { title?: string } };
      setError(json.error?.title ?? "We couldn't sign you in.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-md py-10">
      <h1 className="text-5xl tracking-tight">Open the desk.</h1>
      <p className="mt-4 text-muted">Use your email. No password on this desk.</p>
      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(email);
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@domain.com"
          className="w-full border border-line bg-transparent px-3 py-3 outline-none"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className="h-10 bg-ink px-4 text-sm text-canvas">
            Continue
          </button>
          <button type="button" className="h-10 border border-line px-4 text-sm" onClick={() => void submit(DEMO_EMAIL)}>
            Open the demo desk
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-outflow">{error}</p> : null}
      </form>
    </div>
  );
}
