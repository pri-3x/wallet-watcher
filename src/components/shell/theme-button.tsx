"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeButton() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("ww-theme", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#ffffff" : "#0c0c0b");
    setTheme(next);
  }

  const light = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-sm text-muted hover:text-ink"
      aria-pressed={light}
      aria-label={light ? "Use black theme" : "Use white theme"}
    >
      {light ? "Black" : "White"}
    </button>
  );
}
