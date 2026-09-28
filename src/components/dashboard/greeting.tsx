"use client";

import { useEffect, useState } from "react";
import { RelativeTime } from "@/components/ui/figures";

export function Greeting({ now }: { now: number }) {
  const [label, setLabel] = useState(greeting(new Date(now).getUTCHours()));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLabel(greeting(new Date().getHours())));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <h1 className="text-5xl tracking-tight md:text-6xl">{label}</h1>;
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

export function DeskStamp({ now }: { now: number }) {
  return <RelativeTime timestamp={now} now={now} />;
}
