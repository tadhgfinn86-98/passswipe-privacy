"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Check, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { useAction } from "@/components/action-dialog";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  monthly: number | null;
  yearly: number | null;
  blurb: string;
  features: string[];
  cta: string;
  intent: "plan" | "sales";
  popular?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    blurb: "For individuals exploring AI automation.",
    features: [
      "3 automations",
      "Basic integrations",
      "Task history",
      "Community support",
    ],
    cta: "Start free",
    intent: "plan",
  },
  {
    name: "Pro",
    monthly: 19,
    yearly: 15,
    blurb: "For teams running real work through their agent.",
    features: [
      "Unlimited automations",
      "Advanced integrations",
      "AI workflows",
      "Analytics",
      "Priority support",
      "Team collaboration",
    ],
    cta: "Start Pro",
    intent: "plan",
    popular: true,
  },
  {
    name: "Enterprise",
    monthly: null,
    yearly: null,
    blurb: "For larger organisations with bespoke needs.",
    features: [
      "Unlimited users",
      "Advanced security",
      "Custom workflows",
      "Dedicated support",
      "SSO",
      "Custom integrations",
    ],
    cta: "Talk to sales",
    intent: "sales",
  },
];

export function Pricing() {
  const [yearly, setYearly] = React.useState(false);
  const { open } = useAction();
  const reduce = useReducedMotion();

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="relative">
      <div className="container-page py-20 sm:py-24 lg:py-28">
        <SectionHeading
          eyebrow="Pricing"
          titleId="pricing-title"
          title="Pricing that scales with you"
          description="Start free, upgrade when your agent starts pulling real weight. Every plan includes the full agent."
        />

        {/* Billing toggle */}
        <Reveal delay={0.12}>
          <div className="mt-9 flex items-center justify-center gap-3">
            <span
              className={cn(
                "text-[14px] transition-colors",
                yearly ? "text-muted-foreground" : "font-medium text-foreground",
              )}
            >
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={yearly}
              aria-label="Bill yearly and save 20%"
              onClick={() => setYearly((value) => !value)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200",
                yearly
                  ? "border-transparent bg-[var(--brand)]"
                  : "border-border bg-card-muted",
              )}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
                className={cn(
                  "size-4.5 rounded-full bg-white shadow-subtle",
                  yearly ? "ml-auto mr-[3px]" : "ml-[3px]",
                )}
              />
            </button>
            <span
              className={cn(
                "text-[14px] transition-colors",
                yearly ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              Yearly
            </span>
            <span className="rounded-md bg-[color-mix(in_oklab,var(--success)_14%,transparent)] px-2 py-0.5 text-[12px] font-medium text-[var(--success)]">
              Save 20%
            </span>
          </div>
        </Reveal>

        <div className="mx-auto mt-10 grid max-w-[460px] items-start gap-5 lg:max-w-none lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, index) => {
            const price = yearly ? plan.yearly : plan.monthly;
            return (
              <motion.div
                key={plan.name}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-all duration-300 sm:p-7",
                  plan.popular
                    ? "border-[color-mix(in_oklab,var(--brand)_40%,var(--border))] bg-card shadow-raised lg:-mt-4 lg:pb-9 lg:pt-9"
                    : "border-border bg-card shadow-subtle hover:-translate-y-[3px] hover:border-border-strong hover:shadow-card",
                )}
              >
                {plan.popular ? (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top,var(--brand-soft),transparent_60%)]"
                    />
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--brand)] px-3 py-1 text-[11.5px] font-medium text-[var(--brand-contrast)] shadow-card">
                      <Sparkles className="size-3" />
                      Most popular
                    </span>
                  </>
                ) : null}

                <div className="relative">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
                    {plan.name}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                    {plan.blurb}
                  </p>

                  <div className="mt-6 flex min-h-[52px] items-end gap-1.5">
                    {price === null ? (
                      <span className="text-[40px] font-semibold leading-none tracking-[-0.04em]">
                        Custom
                      </span>
                    ) : (
                      <>
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={`${plan.name}-${price}`}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                            transition={{ duration: 0.22 }}
                            className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums"
                          >
                            £{price}
                          </motion.span>
                        </AnimatePresence>
                        <span className="pb-1 text-[13.5px] text-muted-foreground">
                          /month
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 h-4 text-[12px] text-subtle-foreground">
                    {price === null
                      ? "Annual agreement · volume pricing"
                      : yearly
                        ? "Billed annually"
                        : "Billed monthly"}
                  </p>

                  <Button
                    variant={plan.popular ? "primary" : "secondary"}
                    size="lg"
                    className="mt-6 w-full"
                    onClick={() =>
                      plan.intent === "sales" ? open("sales") : open("plan", plan.name)
                    }
                  >
                    {plan.cta}
                    <ButtonArrow />
                  </Button>

                  <ul className="mt-7 flex flex-col gap-3 border-t border-border pt-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-[14px]">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full",
                            plan.popular
                              ? "bg-brand-soft text-[var(--brand)]"
                              : "bg-card-muted text-muted-foreground",
                          )}
                        >
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-8 text-center text-[13px] text-subtle-foreground">
            All prices in GBP, excluding VAT. Cancel or change plan at any time.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
