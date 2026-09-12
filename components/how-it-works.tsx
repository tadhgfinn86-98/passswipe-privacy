"use client";

import * as React from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Check,
  Loader2,
  MessagesSquare,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    title: "Ask your AI agent",
    description:
      "Describe the outcome in plain language. No scripts, no rule trees, no onboarding project.",
  },
  {
    number: "02",
    title: "Let it process the task",
    description:
      "The agent gathers context from your tools, resolves conflicts and picks the right next action.",
  },
  {
    number: "03",
    title: "Receive actionable results",
    description:
      "You get a finished result with the reasoning attached — approve it or adjust it in one click.",
  },
  {
    number: "04",
    title: "Improve continuously",
    description:
      "Every accepted outcome sharpens the next one. Your workflows get faster the more you use them.",
  },
];

function StepVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="flex h-full flex-col justify-end gap-3">
        <div className="self-end rounded-2xl rounded-tr-md bg-[var(--brand)] px-3.5 py-2.5 text-[13px] text-[var(--brand-contrast)]">
          Draft the weekly client update and send it for review.
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
          <MessagesSquare className="size-3.5 text-subtle-foreground" />
          <span className="flex-1 text-[12.5px] text-subtle-foreground">
            Ask your agent anything…
          </span>
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-contrast)]">
            <Send className="size-3.5" />
          </span>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <ul className="flex h-full flex-col justify-center gap-2.5">
        {[
          { label: "Collecting last week's activity", state: "done" },
          { label: "Summarising 14 threads", state: "running" },
          { label: "Matching your house style", state: "pending" },
        ].map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-[12.5px]"
          >
            {item.state === "done" ? (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            ) : item.state === "running" ? (
              <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
            ) : (
              <span className="size-4 rounded-full border border-dashed border-border-strong" />
            )}
            <span
              className={cn(
                item.state === "pending" ? "text-subtle-foreground/70" : "text-foreground",
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (index === 2) {
    return (
      <div className="flex h-full flex-col justify-center">
        <div className="rounded-xl border border-border bg-surface p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">
            Ready to send
          </p>
          <p className="mt-1 text-[15px] font-medium">Weekly update — Meridian</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Three wins, one risk flagged, and next week&rsquo;s priorities. Drafted in your
            tone from 14 source threads.
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-lg bg-[var(--brand)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--brand-contrast)]">
              Approve &amp; send
            </span>
            <span className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium">
              Edit
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-end gap-1.5">
        {[32, 44, 40, 58, 66, 74, 92].map((value, barIndex) => (
          <motion.span
            key={barIndex}
            initial={{ height: 6 }}
            animate={{ height: value }}
            transition={{ duration: 0.6, delay: barIndex * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-t-md bg-[color-mix(in_oklab,var(--brand)_30%,transparent)]"
          />
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
        <TrendingUp className="size-4 text-[var(--success)]" />
        <span className="text-[12.5px]">
          <span className="font-medium">+31%</span>{" "}
          <span className="text-muted-foreground">faster than week one</span>
        </span>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 65%", "end 75%"],
  });

  const progressScale = useTransform(scrollYProgress, [0, 1], [0.02, 1]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const index = Math.min(steps.length - 1, Math.max(0, Math.floor(value * steps.length)));
    setActive(index);
  });

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="relative">
      <div className="container-page py-20 sm:py-24 lg:py-28">
        <SectionHeading
          eyebrow={
            <>
              <Sparkles className="size-3 text-[var(--brand)]" />
              How it works
            </>
          }
          titleId="how-it-works-title"
          title="Simple. Seamless. Smart."
          description="From your first instruction to continuous optimisation, your AI agent handles the heavy lifting."
        />

        {/* Desktop: sticky scroll narrative */}
        <div ref={sectionRef} className="mt-16 hidden lg:block">
          <div className="grid grid-cols-12 gap-14">
            <div className="col-span-5">
              <div className="sticky top-28">
                <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-grid-faint opacity-50"
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-subtle-foreground">
                        STEP {steps[active].number}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-[var(--brand)] animate-soft-pulse" />
                        {steps[active].title}
                      </span>
                    </div>
                    <div className="min-h-0 flex-1">
                      <motion.div
                        key={active}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full"
                      >
                        <StepVisual index={active} />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-7">
              <div className="relative pl-10">
                <div className="absolute left-[13px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
                <motion.div
                  style={{ scaleY: progressScale }}
                  className="absolute left-[13px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-[var(--brand)]"
                />

                <ol className="flex flex-col gap-3">
                  {steps.map((step, index) => {
                    const isActive = index === active;
                    return (
                      <li key={step.number} className="relative">
                        <span
                          className={cn(
                            "absolute -left-10 top-7 size-[9px] -translate-x-[4px] rounded-full border-2 transition-colors duration-300",
                            isActive
                              ? "border-[var(--brand)] bg-[var(--brand)]"
                              : "border-border-strong bg-[var(--background)]",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setActive(index)}
                          className={cn(
                            "w-full rounded-2xl border p-6 text-left transition-all duration-300",
                            isActive
                              ? "border-border-strong bg-card shadow-card"
                              : "border-transparent bg-transparent hover:border-border",
                          )}
                        >
                          <div className="flex items-baseline gap-3">
                            <span
                              className={cn(
                                "font-mono text-[12px] transition-colors",
                                isActive ? "text-[var(--brand)]" : "text-subtle-foreground",
                              )}
                            >
                              {step.number}
                            </span>
                            <h3 className="text-[19px] font-semibold tracking-[-0.02em]">
                              {step.title}
                            </h3>
                          </div>
                          <p
                            className={cn(
                              "mt-2 max-w-md text-[15px] leading-relaxed transition-colors",
                              isActive ? "text-muted-foreground" : "text-subtle-foreground",
                            )}
                          >
                            {step.description}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <ol className="mt-12 flex flex-col gap-4 lg:hidden">
          {steps.map((step, index) => (
            <motion.li
              key={step.number}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-border bg-card p-5 shadow-subtle"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-[var(--brand)]">
                  {step.number}
                </span>
                <h3 className="text-[17px] font-semibold tracking-[-0.02em]">
                  {step.title}
                </h3>
              </div>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <div className="mt-4 h-[150px] rounded-xl border border-border bg-surface p-3">
                <StepVisual index={index} />
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
