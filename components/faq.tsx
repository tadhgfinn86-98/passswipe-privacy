"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/action-dialog";
import { faqs } from "@/lib/faqs";
import { cn } from "@/lib/utils";


function FaqItem({
  faq,
  isOpen,
  onToggle,
  index,
}: {
  faq: (typeof faqs)[number];
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-colors duration-200",
        isOpen ? "border-border-strong shadow-subtle" : "border-border hover:border-border-strong",
      )}
    >
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4.5 text-left sm:px-6"
        >
          <span className="text-[15px] font-medium tracking-[-0.01em] sm:text-[16px]">
            {faq.question}
          </span>
          <span
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-300",
              isOpen && "rotate-45 border-transparent bg-brand-soft text-[var(--brand)]",
            )}
          >
            <Plus className="size-3.5" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-muted-foreground sm:px-6 sm:pb-6">
              {faq.answer}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  const { open: openDialog } = useAction();

  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-border bg-surface">
      <div className="container-page py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <SectionHeading
              align="left"
              eyebrow="FAQ"
              size="compact"
              titleId="faq-title"
              title="Frequently asked questions"
              description="Everything teams ask before they hand the busywork over."
            />
            <Reveal delay={0.15}>
              <div className="mt-7 rounded-2xl border border-border bg-card p-5">
                <p className="text-[14px] font-medium">Still deciding?</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  Talk to someone who has rolled this out for a team like yours.
                </p>
                <Button
                  variant="secondary"
                  size="md"
                  className="mt-4 w-full"
                  onClick={() => openDialog("sales")}
                >
                  Talk to sales
                </Button>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <div className="flex flex-col gap-3">
              {faqs.map((faq, index) => (
                <Reveal key={faq.question} delay={index * 0.04}>
                  <FaqItem
                    faq={faq}
                    index={index}
                    isOpen={open === index}
                    onToggle={() => setOpen(open === index ? null : index)}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
