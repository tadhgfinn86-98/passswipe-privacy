import * as React from "react";
import { cn } from "@/lib/utils";

const palettes = [
  "from-indigo-400 to-violet-500",
  "from-sky-400 to-cyan-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-slate-400 to-slate-600",
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function hash(value: string) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total + value.charCodeAt(i)) % 997;
  return total;
}

/**
 * Deterministic, asset-free avatar: gradient chip with initials.
 * Keeps the page free of stock photography and external image requests.
 */
export function Avatar({
  name,
  className,
  size = 40,
  ring = true,
}: {
  name: string;
  className?: string;
  size?: number;
  ring?: boolean;
}) {
  const palette = palettes[hash(name) % palettes.length];
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold tracking-tight text-white select-none",
        palette,
        ring && "ring-2 ring-[var(--card)]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
