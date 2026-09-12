"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Fingerprint, Gauge, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { Button, ButtonArrow } from "@/components/ui/button";
import { useAction } from "@/components/action-dialog";

const cards = [
  {
    icon: ShieldCheck,
    title: "Advanced task security",
    body: "Protect workflow data with secure access controls and encryption in transit and at rest.",
    points: ["SOC 2 Type II aligned", "Role-based permissions", "Full audit trail"],
  },
  {
    icon: Gauge,
    title: "Built to scale",
    body: "Support growing teams, workspaces, and automation volume without re-architecting anything.",
    points: ["99.99% uptime target", "Regional data residency", "Unlimited workspaces"],
  },
];

const badges = [
  { icon: Lock, label: "AES-256 encryption" },
  { icon: KeyRound, label: "SSO & SCIM" },
  { icon: Fingerprint, label: "Zero data training" },
];

export function Security() {
  const { open } = useAction();
  const reduce = useReducedMotion();

  return (
    <section
      id="security"
      aria-labelledby="security-title"
      className="relative isolate overflow-hidden bg-[#08090a] text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%)",
          }}
        />
        <div className="absolute left-1/2 top-[-14rem] size-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(127,123,245,.28),transparent_62%)] blur-2xl" />
        <div className="absolute bottom-[-16rem] right-[-6rem] size-[30rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,.14),transparent_65%)] blur-2xl" />
      </div>

      <div className="container-page py-20 sm:py-24 lg:py-28">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <Eyebrow tone="dark">
              <ShieldCheck className="size-3" />
              Security
            </Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              id="security-title"
              className="mt-5 max-w-2xl text-balance-tight text-[length:var(--text-h2)] font-semibold text-white"
            >
              Built for secure growth
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-white/60 sm:text-[17px]">
              Powerful automation shouldn&rsquo;t mean compromising control. Your workflows
              stay secure, private, and ready to scale.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-[3px] hover:border-white/20 sm:p-7"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-60"
                />
                <span className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 transition-colors duration-300 group-hover:border-white/20">
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">
                  {card.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/55">
                  {card.body}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {card.points.map((point) => (
                    <li
                      key={point}
                      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-col items-center gap-6">
            <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <li
                    key={badge.label}
                    className="flex items-center gap-2 text-[13px] text-white/45"
                  >
                    <Icon className="size-3.5" strokeWidth={1.7} />
                    {badge.label}
                  </li>
                );
              })}
            </ul>
            <Button
              variant="outlineInverse"
              size="lg"
              onClick={() => open("sales")}
            >
              Read our security overview
              <ButtonArrow />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
