"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Bot,
  FileInput,
  GitFork,
  Plus,
  Send,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Node = {
  kind: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
};

const nodes: Node[] = [
  {
    kind: "When",
    title: "New customer submits form",
    detail: "Triggers the moment a response lands — web form, email or API.",
    icon: FileInput,
    tone: "var(--accent-sky)",
  },
  {
    kind: "AI Agent",
    title: "Analyse request",
    detail: "Reads the message, extracts intent, company size and urgency.",
    icon: Bot,
    tone: "var(--brand)",
  },
  {
    kind: "If",
    title: "High priority",
    detail: "Branches on the agent's score. Anything below 0.7 goes to the queue.",
    icon: GitFork,
    tone: "var(--warning)",
  },
  {
    kind: "Then",
    title: "Notify sales team",
    detail: "Posts to #inbound with a summary and a one-click claim button.",
    icon: Send,
    tone: "var(--success)",
  },
  {
    kind: "Create",
    title: "CRM opportunity",
    detail: "Opens a deal, attaches the transcript and sets the next step.",
    icon: Target,
    tone: "var(--brand)",
  },
];

export function AutomationDemo() {
  // Hover previews a node; clicking (or tapping) pins it open.
  const [pinned, setPinned] = React.useState(1);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const active = hovered ?? pinned;
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[var(--brand)]" />
          <span className="text-[13px] font-medium">Inbound lead routing</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--success)] animate-soft-pulse" />
          Active
        </span>
      </div>

      <div className="relative p-4 sm:p-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-dots-faint opacity-60"
        />

        <ol className="relative flex flex-col items-stretch">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isActive = active === index;
            return (
              <li key={node.title} className="flex flex-col items-center">
                {index > 0 ? (
                  <motion.div
                    initial={reduce ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
                    whileInView={{ scaleY: 1, opacity: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.3, delay: index * 0.12 }}
                    className="relative h-7 w-px origin-top bg-border-strong"
                  >
                    <span
                      className={cn(
                        "absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-300",
                        isActive || active === index - 1
                          ? "bg-[var(--brand)]"
                          : "bg-border-strong",
                      )}
                    />
                  </motion.div>
                ) : null}

                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.12,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="w-full max-w-[420px]"
                >
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(index)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setPinned(index)}
                    aria-expanded={isActive}
                    className={cn(
                      "group w-full rounded-xl border bg-card p-3 text-left transition-all duration-200",
                      isActive
                        ? "-translate-y-[2px] border-[color-mix(in_oklab,var(--brand)_45%,var(--border))] shadow-raised"
                        : "border-border shadow-subtle hover:-translate-y-[2px] hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border"
                        style={{
                          background: `color-mix(in oklab, ${node.tone} 12%, transparent)`,
                          color: node.tone,
                        }}
                      >
                        <Icon className="size-4" strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-subtle-foreground">
                          {node.kind}
                        </p>
                        <p className="truncate text-[13.5px] font-medium">{node.title}</p>
                      </div>
                      <span
                        className={cn(
                          "ml-auto text-subtle-foreground transition-transform duration-200",
                          isActive && "rotate-45",
                        )}
                      >
                        <Plus className="size-3.5" />
                      </span>
                    </div>

                    <AnimatePresence initial={false}>
                      {isActive ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="mt-3 border-t border-border pt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                            {node.detail}
                          </p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </button>
                </motion.div>
              </li>
            );
          })}
        </ol>

        <p className="relative mt-5 text-center text-[11.5px] text-subtle-foreground">
          Hover or tap a step to inspect it
        </p>
      </div>
    </div>
  );
}
