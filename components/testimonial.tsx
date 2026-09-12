"use client";

import { Quote } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";

export function Testimonial() {
  const reduce = useReducedMotion();

  return (
    <section aria-labelledby="testimonial-title" className="border-y border-border bg-surface">
      <div className="container-page py-20 sm:py-24">
        <figure className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card text-[var(--brand)] shadow-subtle">
              <Quote className="size-5" strokeWidth={1.8} />
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <blockquote
              id="testimonial-title"
              className="mt-8 text-balance text-[24px] font-medium leading-[1.32] tracking-[-0.025em] sm:text-[32px] lg:text-[38px]"
            >
              &ldquo;Tasks that used to consume hours now happen in the background. Our team
              can finally focus on work that actually moves the business forward.&rdquo;
            </blockquote>
          </Reveal>

          <Reveal delay={0.12}>
            <figcaption className="mt-8 flex items-center justify-center gap-3">
              <Avatar name="Elena Voss" size={44} />
              <div className="text-left">
                <p className="text-[14.5px] font-medium">Elena Voss</p>
                <p className="text-[13px] text-muted-foreground">
                  VP Operations &middot; Meridian
                </p>
              </div>
            </figcaption>
          </Reveal>

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-10 grid w-full max-w-lg grid-cols-3 divide-x divide-border border-y border-border"
          >
            {[
              { value: "12h", label: "Saved per person / week" },
              { value: "3.4x", label: "Faster response times" },
              { value: "96%", label: "Automations run clean" },
            ].map((stat) => (
              <div key={stat.label} className="px-3 py-5">
                <p className="text-[22px] font-semibold tracking-[-0.03em] sm:text-[26px]">
                  {stat.value}
                </p>
                <p className="mt-1 text-[11.5px] leading-tight text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </figure>
      </div>
    </section>
  );
}
