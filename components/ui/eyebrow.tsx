import * as React from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium tracking-[-0.01em]",
        tone === "light"
          ? "border-border bg-card text-muted-foreground shadow-subtle"
          : "border-white/10 bg-white/5 text-white/70 backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}
