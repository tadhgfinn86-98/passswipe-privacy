"use client";

import { ArrowRight, Sparkles } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="relative z-50 border-b border-border bg-surface">
      <div className="container-page">
        <a
          href="#automation"
          className="group mx-auto flex h-10 w-full items-center justify-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles
            className="size-3.5 text-[var(--brand)] transition-transform duration-300 group-hover:rotate-12"
            strokeWidth={2}
          />
          <span className="font-medium text-foreground">Introducing custom automations</span>
          <span className="hidden sm:inline">— build any workflow in minutes</span>
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  );
}
