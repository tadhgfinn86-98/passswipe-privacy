import * as React from "react";
import { cn } from "@/lib/utils";

/** Original SkyAgent mark: an orbiting node inside a soft-cornered chip. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <defs>
        <linearGradient id="skyagent-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--accent-sky)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#skyagent-mark)" />
      <path
        d="M10 20.2c3.9 2.6 8.1 2.6 12 0"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 11.8c-3.9-2.6-8.1-2.6-12 0"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="3.1" fill="white" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "auto",
}: {
  className?: string;
  tone?: "auto" | "inverse";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span
        className={cn(
          "text-[15px] font-semibold tracking-[-0.02em]",
          tone === "inverse" ? "text-white" : "text-foreground",
        )}
      >
        SkyAgent
      </span>
    </span>
  );
}
