"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { CollaborationDemo } from "@/components/collaboration-demo";
import { Integrations } from "@/components/integrations";
import { AnalyticsDemo } from "@/components/analytics-demo";
import { AutomationDemo } from "@/components/automation-demo";
import { SectionHeading } from "@/components/ui/section-heading";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type Feature = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
};

const features: Feature[] = [
  {
    id: "collaboration",
    eyebrow: "Collaboration",
    title: "Real-time AI collaboration",
    description:
      "Work alongside an intelligent agent that understands your context, coordinates tasks, and keeps your team aligned.",
    points: [
      "Shared threads your whole team can follow",
      "Tasks assigned, chased and closed automatically",
      "Every decision traceable back to its source",
    ],
    visual: <CollaborationDemo />,
  },
  {
    id: "integrations",
    eyebrow: "Integrations",
    title: "Everything connected",
    description:
      "Connect the tools your team already uses and let your agent move information between them.",
    points: [
      "40+ native connectors, no glue code",
      "Two-way sync that respects your permissions",
      "Add a tool and the agent adapts instantly",
    ],
    visual: <Integrations />,
    flip: true,
  },
  {
    id: "insights",
    eyebrow: "Insights",
    title: "Turn data into decisions",
    description:
      "See exactly what your agent handled, how much time it returned to the team, and where the next win is hiding.",
    points: [
      "Live metrics on every automation run",
      "Time saved translated into real capacity",
      "Alerts the moment success rates dip",
    ],
    visual: <AnalyticsDemo />,
  },
  {
    id: "automation",
    eyebrow: "Automation",
    title: "Set it once. Let AI handle the rest.",
    description:
      "Describe the outcome you want and the agent builds the workflow, branches and follow-ups around it.",
    points: [
      "Visual builder with conditional branching",
      "Agent steps that reason, not just relay",
      "Version history and one-click rollback",
    ],
    visual: <AutomationDemo />,
    flip: true,
  },
];

export function FeatureSection() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative">
      <div className="container-page py-20 sm:py-24 lg:py-28">
        <SectionHeading
          eyebrow="Platform"
          titleId="features-title"
          title="Empower your workflow with AI"
          description="Delegate repetitive work, connect your tools, and turn information into action."
        />

        <div className="mt-16 flex flex-col gap-20 sm:mt-20 sm:gap-24 lg:gap-32">
          {features.map((feature) => (
            <article
              key={feature.id}
              id={feature.id}
              className="grid scroll-mt-28 items-center gap-8 lg:grid-cols-12 lg:gap-14"
            >
              <div
                className={cn(
                  "lg:col-span-5",
                  feature.flip ? "lg:order-2 lg:col-start-8" : "lg:order-1",
                )}
              >
                <Reveal>
                  <Eyebrow>{feature.eyebrow}</Eyebrow>
                </Reveal>
                <Reveal delay={0.05}>
                  <h3 className="mt-4 text-balance text-[length:var(--text-h3)] font-semibold tracking-[-0.03em] leading-[1.1]">
                    {feature.title}
                  </h3>
                </Reveal>
                <Reveal delay={0.1}>
                  <p className="mt-4 text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
                    {feature.description}
                  </p>
                </Reveal>
                <Reveal delay={0.15}>
                  <ul className="mt-6 flex flex-col gap-3">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-[14.5px]">
                        <span className="mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[var(--brand)]">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>

              <Reveal
                delay={0.1}
                y={24}
                className={cn(
                  "min-w-0 lg:col-span-7",
                  feature.flip ? "lg:order-1 lg:col-start-1" : "lg:order-2",
                )}
              >
                {feature.visual}
              </Reveal>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
