"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress, isEnsName, isTxHash } from "@/lib/address";
import { addressOk, findChain, tokenHref, walletHref } from "@/lib/chains/catalog";
import { ChainPicker } from "@/components/wallet/chain-picker";

export function AddressForm({ id = "watch", defaultChain }: { id?: string; defaultChain: string }) {
  const router = useRouter();
  const [chain, setChain] = useState(defaultChain);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selected = findChain(chain) ?? findChain(defaultChain);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) {
      setError("Paste a wallet address to begin.");
      return;
    }
    if (!selected) {
      setError("That chain isn't available.");
      return;
    }
    if (addressOk(selected.id, query) || (selected.ens && isEnsName(query))) {
      if (selected.family === "evm" && isAddress(query)) {
        setPending(true);
        const identified = await fetch(`/api/tokens/identify?chain=${selected.id}&address=${encodeURIComponent(query)}`)
          .then((response) => response.json() as Promise<{ token?: boolean }>)
          .catch(() => null);
        setPending(false);
        router.push(identified?.token ? tokenHref(query, selected.id) : walletHref(query, selected.id));
        return;
      }
      router.push(walletHref(query, selected.id));
      return;
    }
    if (selected.family === "evm" && isTxHash(query)) {
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
    setError(
      selected.family === "solana"
        ? "That doesn't look like a Solana address."
        : `That doesn't look like a ${selected.name} address.`,
    );
  }

  return (
    <form id={id} onSubmit={onSubmit} className="w-full max-w-xl">
      <ChainPicker value={selected?.id ?? chain} onChange={setChain} />
      <div className="flex border border-line">
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder={
            selected?.family === "solana"
              ? "Paste a Solana address"
              : selected?.ens
                ? "Paste a wallet, token, or ENS"
                : "Paste a wallet or token"
          }
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
