"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="h-10 border border-line px-4 text-sm"
      onClick={async () => {
        await fetch("/api/auth/session", { method: "DELETE" });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
