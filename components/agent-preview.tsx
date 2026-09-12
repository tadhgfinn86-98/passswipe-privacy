"use client";

import * as React from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  Check,
  ChevronDown,
  Command,
  LayoutGrid,
  ListChecks,
  Loader2,
  Plug,
  RotateCcw,
  Search,
  Send,
  Workflow,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

const sidebar = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Tasks", icon: ListChecks },
  { label: "Automations", icon: Workflow },
  { label: "Integrations", icon: Plug },
  { label: "Analytics", icon: BarChart3 },
];

const checks = [
  { label: "Reading 8 team calendars", done: "8 calendars checked" },
  { label: "Comparing availability windows", done: "3 conflicts resolved" },
  { label: "Scoring the best slot", done: "Best time found" },
];

const attendees = ["Mara Ellis", "Tom Vance", "Priya Raman", "Kai Osei"];

/** Timeline in ms for each step of the demo. */
const STEP_DELAYS = [900, 1100, 700, 1150, 1050, 950, 900, 5200];

export function AgentPreview() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.25 });
  const reduce = useReducedMotion();
  const [playhead, setPlayhead] = React.useState(0);
  // With reduced motion the demo shows its finished state instead of animating.
  const step = reduce ? 7 : playhead;

  React.useEffect(() => {
    if (reduce || !inView) return;
    const timer = window.setTimeout(
      () => setPlayhead((current) => (current >= 7 ? 0 : current + 1)),
      STEP_DELAYS[step],
    );
    return () => window.clearTimeout(timer);
  }, [step, inView, reduce]);

  const showAgentTyping = step === 1;
  const showAgentReply = step >= 2;
  const showChecks = step >= 3;
  const showResult = step >= 6;
  const checkState = (index: number) => {
    const activeIndex = step - 3;
    if (step >= 6) return "done" as const;
    if (activeIndex > index) return "done" as const;
    if (activeIndex === index) return "running" as const;
    return "pending" as const;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-window sm:rounded-[20px]">
        {/* Window chrome */}
        <div className="flex h-11 items-center gap-3 border-b border-border bg-surface px-3.5 sm:px-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="size-2.5 rounded-full bg-[#28c840]/80" />
          </div>
          <div className="mx-auto hidden h-6 max-w-[260px] flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] text-subtle-foreground sm:flex">
            <Search className="size-3" />
            app.skyagent.com / workspace
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Bell className="size-3.5 text-subtle-foreground" />
            <div className="flex -space-x-1.5">
              {attendees.slice(0, 3).map((name) => (
                <Avatar key={name} name={name} size={20} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-[420px] sm:min-h-[460px]">
          {/* Sidebar */}
          <aside className="hidden w-[188px] shrink-0 flex-col border-r border-border bg-surface p-3 md:flex">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
              <LogoMark className="size-5" />
              <span className="text-[12.5px] font-semibold tracking-tight">Northwind</span>
              <ChevronDown className="ml-auto size-3.5 text-subtle-foreground" />
            </div>

            <ul className="mt-3 flex flex-col gap-0.5">
              {sidebar.map((item, index) => {
                const Icon = item.icon;
                const active = index === 1;
                return (
                  <li key={item.label}>
                    <span
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors",
                        active
                          ? "bg-card text-foreground shadow-subtle"
                          : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={1.9} />
                      {item.label}
                      {index === 2 ? (
                        <span className="ml-auto rounded-md bg-brand-soft px-1.5 py-px text-[10px] font-medium text-[var(--brand)]">
                          6
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-2 rounded-full bg-[var(--success)] animate-soft-pulse" />
                  <span className="relative inline-flex size-2 rounded-full bg-[var(--success)]" />
                </span>
                <span className="text-[11.5px] font-medium">Agent online</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-subtle-foreground">
                12 tasks handled today
              </p>
            </div>
          </aside>

          {/* Conversation */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-3.5 text-[var(--brand)]" />
                <span className="text-[12.5px] font-medium">Scheduling assistant</span>
              </div>
              <button
                type="button"
                onClick={() => setPlayhead(0)}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11.5px] text-subtle-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Replay
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5">
              {/* User message */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-start justify-end gap-2.5"
              >
                <p className="max-w-[86%] rounded-2xl rounded-tr-md bg-[var(--brand)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--brand-contrast)] sm:text-[13.5px]">
                  Schedule a team meeting that works for everyone.
                </p>
                <Avatar name="Mara Ellis" size={26} ring={false} />
              </motion.div>

              {/* Agent reply */}
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex size-[26px] shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <LogoMark className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <AnimatePresence mode="wait">
                    {showAgentTyping ? (
                      <motion.div
                        key="typing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card-muted px-3.5 py-3"
                      >
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            className="size-1.5 rounded-full bg-subtle-foreground"
                            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: dot * 0.15,
                            }}
                          />
                        ))}
                      </motion.div>
                    ) : showAgentReply ? (
                      <motion.p
                        key="reply"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="inline-block max-w-[92%] rounded-2xl rounded-tl-md border border-border bg-card-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground sm:text-[13.5px]"
                      >
                        I&rsquo;ll find the best time across everyone&rsquo;s calendars.
                      </motion.p>
                    ) : null}
                  </AnimatePresence>

                  {/* Processing steps */}
                  <AnimatePresence>
                    {showChecks ? (
                      <motion.ul
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3"
                      >
                        {checks.map((item, index) => {
                          const state = checkState(index);
                          return (
                            <li
                              key={item.label}
                              className={cn(
                                "flex items-center gap-2 text-[12.5px] transition-colors duration-300",
                                state === "pending"
                                  ? "text-subtle-foreground/60"
                                  : state === "running"
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                              )}
                            >
                              {state === "done" ? (
                                <motion.span
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="inline-flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]"
                                >
                                  <Check className="size-2.5" strokeWidth={3} />
                                </motion.span>
                              ) : state === "running" ? (
                                <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
                              ) : (
                                <span className="inline-block size-4 rounded-full border border-dashed border-border-strong" />
                              )}
                              <span className="truncate">
                                {state === "done" ? item.done : item.label}
                              </span>
                            </li>
                          );
                        })}
                      </motion.ul>
                    ) : null}
                  </AnimatePresence>

                  {/* Result card */}
                  <AnimatePresence>
                    {showResult ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-card"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                              Proposed time
                            </p>
                            <p className="mt-0.5 text-[19px] font-semibold tracking-tight">
                              Tuesday &middot; 14:30
                            </p>
                            <p className="text-[12px] text-muted-foreground">
                              45 minutes &middot; 8 attendees &middot; no conflicts
                            </p>
                          </div>
                          <div className="flex -space-x-2">
                            {attendees.map((name) => (
                              <Avatar key={name} name={name} size={28} />
                            ))}
                            <span className="inline-flex size-7 items-center justify-center rounded-full bg-card-muted text-[10.5px] font-medium text-muted-foreground ring-2 ring-[var(--card)]">
                              +4
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 border-t border-border bg-surface px-3.5 py-2.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--brand-contrast)]">
                            <Send className="size-3" />
                            Send invite
                          </span>
                          <span className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium">
                            Adjust
                          </span>
                          <span className="ml-auto hidden items-center gap-1 text-[11px] text-subtle-foreground sm:flex">
                            <Command className="size-3" />
                            &crarr; to confirm
                          </span>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>

              {/* Composer */}
              <div className="mt-auto flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="flex-1 truncate text-[12.5px] text-subtle-foreground">
                  Ask your agent anything…
                </span>
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)]">
                  <Send className="size-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
