"use client";

import Link from "next/link";
import { Mark } from "@/components/brand/mark";
import { usePalette } from "@/components/shell/providers";
import { ThemeButton } from "@/components/shell/theme-button";

export function SiteHeader() {
  const { openPalette } = usePalette();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-sm">
          <Mark />
          <span>Wallet Watch</span>
        </Link>
        <div className="flex items-center gap-6 text-sm text-muted">
          <ThemeButton />
          <button type="button" onClick={openPalette} className="flex items-center gap-3 hover:text-ink">
            Search
            <kbd className="hidden border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline">⌘K</kbd>
          </button>
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
