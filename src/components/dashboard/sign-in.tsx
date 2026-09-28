"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export function SignInPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function post(body: Record<string, string>) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: { title?: string } };
      setError(json.error?.title ?? "We couldn't sign you in.");
      return;
    }
    router.refresh();
  }

  const creating = mode === "signup";

  return (
    <div className="max-w-md py-10">
      <h1 className="text-5xl tracking-tight">{creating ? "Open a desk." : "Open the desk."}</h1>
      <p className="mt-4 text-muted">
        {creating ? "Your email and a password of at least 8 characters." : "Your email and password."}
      </p>
      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          void post({ mode, email, password });
        }}
      >
        <label className="block text-sm">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@domain.com"
            className="mt-2 w-full border border-line bg-transparent px-3 py-3 outline-none"
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="eyebrow">Password</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={creating ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full border border-line bg-transparent px-3 py-3 outline-none"
          />
        </label>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="h-10 bg-ink px-4 text-sm text-canvas">
            {creating ? "Create account" : "Continue"}
          </button>
          <button
            type="button"
            className="h-10 border border-line px-4 text-sm"
            disabled={pending}
            onClick={() => void post({ mode: "demo" })}
          >
            Open the demo desk
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-outflow">{error}</p> : null}
      </form>
      <button
        type="button"
        className="mt-8 text-sm text-muted hover:text-ink"
        onClick={() => {
          setMode(creating ? "signin" : "signup");
          setError(null);
        }}
      >
        {creating ? "Already have a desk? Sign in." : "New here? Create an account."}
      </button>
    </div>
  );
}
