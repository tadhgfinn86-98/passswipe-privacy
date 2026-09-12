"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Sparkles } from "lucide-react";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { useAction } from "@/components/action-dialog";

/** Fixed positions keep server and client markup identical. */
const particles = [
  { left: "8%", top: "26%", size: 3, delay: 0, duration: 7.5 },
  { left: "18%", top: "64%", size: 2, delay: 1.4, duration: 9 },
  { left: "31%", top: "16%", size: 2.5, delay: 0.8, duration: 8.2 },
  { left: "44%", top: "76%", size: 2, delay: 2.1, duration: 10 },
  { left: "57%", top: "22%", size: 3, delay: 0.4, duration: 8.8 },
  { left: "69%", top: "58%", size: 2, delay: 1.8, duration: 7.8 },
  { left: "81%", top: "30%", size: 2.5, delay: 1.1, duration: 9.4 },
  { left: "92%", top: "68%", size: 2, delay: 2.6, duration: 8.4 },
];

export function FinalCta() {
  const { open } = useAction();
  const reduce = useReducedMotion();

  return (
    <section aria-labelledby="final-cta-title" className="relative isolate overflow-hidden">
      <div className="container-page py-20 sm:py-24 lg:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-card sm:px-10 sm:py-20 lg:py-24">
          {/* Ambient layers */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-grid-faint opacity-60" />
            <div className="absolute left-1/2 top-[-9rem] size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_62%)] blur-2xl" />
            <div className="absolute bottom-[-12rem] left-[6%] size-[22rem] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent-sky)_14%,transparent),transparent_66%)] blur-2xl" />
            {!reduce
              ? particles.map((particle, index) => (
                  <motion.span
                    key={index}
                    className="absolute rounded-full bg-[var(--brand)]/40"
                    style={{
                      left: particle.left,
                      top: particle.top,
                      width: particle.size,
                      height: particle.size,
                    }}
                    animate={{ y: [0, -22, 0], opacity: [0.2, 0.75, 0.2] }}
                    transition={{
                      duration: particle.duration,
                      delay: particle.delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))
              : null}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[var(--card)]" />
          </div>

          <div className="relative flex flex-col items-center">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted-foreground">
                <Sparkles className="size-3 text-[var(--brand)]" />
                14-day free trial
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h2
                id="final-cta-title"
                className="mt-6 max-w-3xl text-balance-tight text-[length:var(--text-h2)] font-semibold"
              >
                Automate. Simplify. Thrive.
              </h2>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-lg text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">
                Give your team back the time to focus on what matters.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
                <Button size="xl" className="w-full sm:w-auto" onClick={() => open("signup")}>
                  Start your free trial
                  <ButtonArrow />
                </Button>
                <Button
                  variant="secondary"
                  size="xl"
                  className="w-full sm:w-auto"
                  onClick={() => open("sales")}
                >
                  Book a walkthrough
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <p className="mt-5 text-[13px] text-subtle-foreground">
                No credit card required &middot; Cancel anytime
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
