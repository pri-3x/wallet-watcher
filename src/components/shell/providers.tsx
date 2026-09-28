"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CommandPalette } from "@/components/shell/command-palette";

const PaletteContext = createContext<{ openPalette: () => void }>({ openPalette: () => undefined });

export function usePalette() {
  return useContext(PaletteContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteContext.Provider value={{ openPalette: () => setOpen(true) }}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </PaletteContext.Provider>
  );
}
