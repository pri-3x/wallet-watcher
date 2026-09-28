"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/brand/mark";
import { ThemeButton } from "@/components/shell/theme-button";

const PRIMARY = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/wallets", label: "Watched wallets" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/alerts", label: "Alerts" },
];

const SECONDARY = [
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/billing", label: "Billing" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-line md:fixed md:inset-y-0 md:w-56 md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-sm">
          <Mark />
          Wallet Watch
        </Link>
        <ThemeButton />
      </div>
      <nav className="flex gap-4 overflow-x-auto px-5 pb-4 md:mt-6 md:flex-col md:gap-1 md:px-3">
        {PRIMARY.map((link) => (
          <NavLink key={link.href} href={link.href} active={pathname === link.href}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="hidden md:absolute md:right-0 md:bottom-0 md:left-0 md:block md:border-t md:border-line md:px-3 md:pt-4 md:pb-16">
        {SECONDARY.map((link) => (
          <NavLink key={link.href} href={link.href} active={pathname === link.href}>
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="flex gap-4 px-5 pb-4 md:hidden">
        {SECONDARY.map((link) => (
          <NavLink key={link.href} href={link.href} active={pathname === link.href}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`border-l px-3 py-2 text-sm whitespace-nowrap ${
        active ? "border-ink text-ink" : "border-transparent text-faint hover:text-muted"
      }`}
    >
      {children}
    </Link>
  );
}
