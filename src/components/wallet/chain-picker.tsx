"use client";

import { CHAINS } from "@/lib/chains/catalog";

export function ChainPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {CHAINS.map((chain) => (
        <button
          key={chain.id}
          type="button"
          onClick={() => onChange(chain.id)}
          className={value === chain.id ? "text-ink" : "text-faint hover:text-muted"}
        >
          {chain.name}
        </button>
      ))}
    </div>
  );
}
