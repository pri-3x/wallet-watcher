"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress, isEnsName, isTxHash } from "@/lib/address";

export function AddressForm({ id = "watch" }: { id?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) {
      setError("Paste a wallet address to begin.");
      return;
    }
    if (isAddress(query) || isEnsName(query)) {
      router.push(`/wallet/${query}`);
      return;
    }
    if (isTxHash(query)) {
      setPending(true);
      const response = await fetch(`/api/search?q=${query}`);
      const json = (await response.json()) as { results?: Array<{ kind: string; href: string }> };
      const hit = json.results?.find((item) => item.kind === "transaction");
      setPending(false);
      if (!hit) {
        setError("We couldn't find that transaction.");
        return;
      }
      router.push(hit.href);
      return;
    }
    setError("That doesn't look like an Ethereum address.");
  }

  return (
    <form id={id} onSubmit={onSubmit} className="w-full max-w-xl">
      <div className="flex border border-line">
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="Paste wallet address or ENS"
          spellCheck={false}
          autoCapitalize="none"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none"
          aria-label="Wallet address"
        />
        <button
          type="submit"
          className="bg-ink px-5 text-sm text-canvas transition-opacity duration-150 hover:opacity-90 active:translate-y-px"
        >
          {pending ? "Looking" : "Watch"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-outflow">{error}</p> : null}
    </form>
  );
}
