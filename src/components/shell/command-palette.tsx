"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/types";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = (await response.json()) as { results?: SearchHit[] };
      setHits(json.results ?? []);
      setActive(0);
      setLoading(false);
    }, 40);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  const selected = hits[active];
  const groups = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.kind) ?? [];
      list.push(hit);
      map.set(hit.kind, list);
    }
    return [...map.entries()];
  }, [hits]);

  if (!open) return null;

  function choose(hit: SearchHit) {
    onOpenChange(false);
    setQuery("");
    router.push(hit.href);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-ink/30" aria-label="Close search" onClick={() => onOpenChange(false)} />
      <div className="relative mx-auto mt-[14vh] w-[min(560px,calc(100%-2rem))] border border-line bg-canvas">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(hits.length - 1, index + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            }
            if (event.key === "Enter" && selected) choose(selected);
          }}
          placeholder="Wallet, hash, ENS, token, protocol"
          className="w-full bg-transparent px-4 py-4 text-lg outline-none"
        />
        <div className="max-h-80 overflow-auto border-t border-line">
          {query && !loading && hits.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Nothing matches.</p>
          ) : null}
          {groups.map(([kind, items]) => (
            <div key={kind} className="py-2">
              <p className="eyebrow px-4 py-2">{kind}</p>
              {items.map((hit) => {
                const index = hits.indexOf(hit);
                return (
                  <button
                    key={`${hit.kind}-${hit.href}-${hit.title}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(hit)}
                    className={`flex w-full items-baseline justify-between px-4 py-2.5 text-left ${
                      index === active ? "bg-wash" : ""
                    }`}
                  >
                    <span className="text-sm">{hit.title}</span>
                    <span className="font-mono text-xs text-faint">{hit.subtitle}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
