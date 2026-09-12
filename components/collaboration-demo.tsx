"use client";

import * as React from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Check, CircleDot, Clock3, Paperclip, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

type Entry =
  | { kind: "user"; author: string; text: string }
  | { kind: "agent"; text: string }
  | { kind: "tasks" };

const thread: Entry[] = [
  {
    kind: "user",
    author: "Priya Raman",
    text: "Can you pull together everything we owe Meridian this week?",
  },
  {
    kind: "agent",
    text: "Found 4 open commitments across Notion, email and your CRM. Here's the shortlist.",
  },
  { kind: "tasks" },
  {
    kind: "user",
    author: "Tom Vance",
    text: "Assign the pricing deck to me and nudge design on the brand pass.",
  },
  {
    kind: "agent",
    text: "Done — reassigned and a reminder goes out at 09:00 tomorrow.",
  },
];

const tasks = [
  { title: "Send revised pricing deck", owner: "Tom Vance", status: "In progress", due: "Today" },
  { title: "Brand pass on onboarding", owner: "Mara Ellis", status: "Blocked", due: "Thu" },
  { title: "Renewal summary for Meridian", owner: "Agent", status: "Done", due: "Sent" },
];

const statusTone: Record<string, string> = {
  "In progress": "text-[var(--brand)] bg-brand-soft",
  Blocked: "text-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_14%,transparent)]",
  Done: "text-[var(--success)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]",
};

export function CollaborationDemo() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  const reduce = useReducedMotion();
  const [played, setPlayed] = React.useState(0);
  const [typingState, setTypingState] = React.useState(false);
  // With reduced motion the thread is shown complete rather than typed out.
  const visible = reduce ? thread.length : played;
  const typing = reduce ? false : typingState;

  React.useEffect(() => {
    if (reduce || !inView || visible >= thread.length) return;
    const next = thread[visible];
    if (next.kind === "agent" && !typing) {
      const timer = window.setTimeout(() => setTypingState(true), 320);
      return () => window.clearTimeout(timer);
    }
    const delay = typing ? 1000 : next.kind === "tasks" ? 520 : 820;
    const timer = window.setTimeout(() => {
      setTypingState(false);
      setPlayed((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [inView, visible, typing, reduce]);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-card">
            <LogoMark className="size-3.5" />
          </span>
          <span className="text-[13px] font-medium">#meridian-account</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[11.5px] text-subtle-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-[var(--success)] animate-soft-pulse" />
            3 online
          </span>
          <div className="flex -space-x-1.5">
            {["Priya Raman", "Tom Vance", "Mara Ellis"].map((name) => (
              <Avatar key={name} name={name} size={22} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-[400px] flex-col gap-3.5 p-4 sm:p-5">
        {thread.slice(0, visible).map((entry, index) => {
          if (entry.kind === "tasks") {
            return (
              <motion.ul
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="ml-9 flex flex-col gap-2"
              >
                {tasks.map((task, taskIndex) => (
                  <motion.li
                    key={task.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: taskIndex * 0.1 }}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-all duration-200 hover:-translate-y-[2px] hover:border-border-strong hover:shadow-subtle"
                  >
                    {task.status === "Done" ? (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--success)_16%,transparent)] text-[var(--success)]">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <CircleDot className="size-5 text-subtle-foreground" strokeWidth={1.6} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{task.title}</p>
                      <p className="flex items-center gap-1.5 text-[11.5px] text-subtle-foreground">
                        <Clock3 className="size-3" />
                        {task.due} &middot; {task.owner}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium",
                        statusTone[task.status],
                      )}
                    >
                      {task.status}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            );
          }

          if (entry.kind === "agent") {
            return (
              <motion.div
                key={`agent-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-start gap-2.5"
              >
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <LogoMark className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-subtle-foreground">
                    SkyAgent
                    <Sparkles className="size-3 text-[var(--brand)]" />
                  </p>
                  <p className="inline-block rounded-2xl rounded-tl-md border border-border bg-card-muted px-3.5 py-2.5 text-[13px] leading-relaxed">
                    {entry.text}
                  </p>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={`user-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-start gap-2.5"
            >
              <Avatar name={entry.author} size={28} ring={false} className="mt-0.5" />
              <div className="min-w-0">
                <p className="mb-1 text-[11.5px] font-medium text-subtle-foreground">
                  {entry.author}
                </p>
                <p className="inline-block rounded-2xl rounded-tl-md border border-border bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed">
                  {entry.text}
                </p>
              </div>
            </motion.div>
          );
        })}

        <AnimatePresence>
          {typing ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                <LogoMark className="size-4" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card-muted px-3.5 py-3">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="size-1.5 rounded-full bg-subtle-foreground"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
                  />
                ))}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-auto flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
          <Paperclip className="size-3.5 text-subtle-foreground" />
          <span className="flex-1 text-[12.5px] text-subtle-foreground">
            Reply or ask the agent…
          </span>
          <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-subtle-foreground sm:block">
            /
          </kbd>
        </div>
      </div>
    </div>
  );
}
