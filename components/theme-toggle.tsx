"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icons are swapped with the `dark` class rather than React state, so the
 * button renders identically on the server and after hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground transition-colors duration-200 hover:border-border-strong hover:text-foreground",
        className,
      )}
    >
      <span className="relative block size-4">
        <Sun
          className="absolute inset-0 size-4 rotate-0 scale-100 opacity-100 transition-all duration-300 dark:-rotate-45 dark:scale-75 dark:opacity-0"
          strokeWidth={1.8}
        />
        <Moon
          className="absolute inset-0 size-4 rotate-45 scale-75 opacity-0 transition-all duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
          strokeWidth={1.8}
        />
      </span>
    </button>
  );
}
