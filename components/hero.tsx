"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { AgentPreview } from "@/components/agent-preview";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { useAction } from "@/components/action-dialog";

export function Hero() {
  const { open } = useAction();
  const reduce = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-faint mask-fade-b opacity-60" />
        <div className="absolute left-1/2 top-[-18rem] size-[46rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_62%)] blur-2xl" />
        <div className="absolute left-[8%] top-[18rem] size-[26rem] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent-sky)_12%,transparent),transparent_65%)] blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[var(--background)]" />
      </div>

      <div className="container-page pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-24">
        <div className="flex flex-col items-center text-center">
          <motion.div {...rise(0)}>
            <Eyebrow>
              <Sparkles className="size-3 text-[var(--brand)]" />
              Now in public beta
            </Eyebrow>
          </motion.div>

          <motion.h1
            {...rise(0.08)}
            className="mt-6 max-w-[19ch] text-balance-tight sm:max-w-[1080px] text-[length:var(--text-display)] font-semibold"
          >
            Meet your AI agent.
            <span className="block bg-gradient-to-br from-[var(--foreground)] via-[var(--foreground)] to-[color-mix(in_oklab,var(--brand)_70%,var(--foreground))] bg-clip-text text-transparent">
              Streamline your workflow.
            </span>
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]"
          >
            An intelligent assistant that handles repetitive work, connects your tools,
            and keeps your team moving.
          </motion.p>

          <motion.div
            {...rise(0.24)}
            className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
          >
            <Button
              size="xl"
              className="w-full sm:w-auto"
              onClick={() => open("signup")}
            >
              Try for free
              <ButtonArrow />
            </Button>
            <Button
              variant="secondary"
              size="xl"
              className="w-full sm:w-auto"
              onClick={() => open("login")}
            >
              Log in
            </Button>
          </motion.div>

          <motion.p
            {...rise(0.3)}
            className="mt-4 text-[13px] text-subtle-foreground"
          >
            Free for 14 days &middot; No credit card required
          </motion.p>
        </div>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-14 max-w-5xl sm:mt-16"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-8 -top-6 h-24 rounded-full bg-[radial-gradient(ellipse_at_center,var(--brand-soft),transparent_70%)] blur-2xl"
          />
          <AgentPreview />
          <div
            aria-hidden="true"
            className="absolute inset-x-10 -bottom-8 h-16 rounded-[50%] bg-[var(--foreground)]/5 blur-2xl"
          />
        </motion.div>

        <motion.a
          {...rise(0.5)}
          href="#features"
          className="group mx-auto mt-14 flex w-fit items-center gap-1.5 text-[13px] text-subtle-foreground transition-colors hover:text-foreground"
        >
          See how it works
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </motion.a>
      </div>
    </section>
  );
}
