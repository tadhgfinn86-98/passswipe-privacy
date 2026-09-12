"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    quote:
      "We shipped our first three automations on day one. By the end of the month the agent was handling the entire inbound triage.",
    name: "Elena Voss",
    role: "VP Operations",
    company: "Meridian",
  },
  {
    quote:
      "It reads context the way a good colleague does. It knows which thread matters and what I actually want done with it.",
    name: "Tom Vance",
    role: "Head of Revenue",
    company: "Northstar",
  },
  {
    quote:
      "Our support queue used to be a morning ritual. Now it's sorted, drafted and mostly answered before anyone logs in.",
    name: "Priya Raman",
    role: "Director of Support",
    company: "Orbit",
  },
  {
    quote:
      "The audit trail sold our security team. Every action the agent takes is logged, scoped and reversible.",
    name: "Jonah Beck",
    role: "CTO",
    company: "Vertex",
  },
  {
    quote:
      "I stopped writing status updates. The agent assembles them from the work we already did, in our own voice.",
    name: "Mara Ellis",
    role: "Programme Lead",
    company: "Linear Labs",
  },
  {
    quote:
      "Setup took an afternoon, not a quarter. That alone made it a different category of tool for us.",
    name: "Kai Osei",
    role: "Operations Manager",
    company: "Nova",
  },
];

export function Testimonials() {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = React.useState({ left: false, right: true });
  const dragState = React.useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  const updateArrows = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScroll({
      left: rail.scrollLeft > 8,
      right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 8,
    });
  }, []);

  React.useEffect(() => {
    updateArrows();
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      rail.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  function scrollBy(direction: 1 | -1) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector("article");
    const amount = card ? card.clientWidth + 20 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: amount * direction, behavior: "smooth" });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const rail = railRef.current;
    if (!rail) return;
    dragState.current = {
      active: true,
      startX: event.clientX,
      startScroll: rail.scrollLeft,
      moved: false,
    };
    rail.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail || !dragState.current.active) return;
    const delta = event.clientX - dragState.current.startX;
    if (Math.abs(delta) > 4) dragState.current.moved = true;
    rail.scrollLeft = dragState.current.startScroll - delta;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail || !dragState.current.active) return;
    dragState.current.active = false;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
  }

  return (
    <section aria-labelledby="testimonials-title" className="relative overflow-hidden">
      <div className="container-page py-20 sm:py-24">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="Customers"
            size="compact"
              titleId="testimonials-title"
            title="Teams that gave the busywork away"
            description="Six thousand teams run their recurring work through SkyAgent."
            className="max-w-2xl"
          />
          <Reveal delay={0.1}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={!canScroll.left}
                aria-label="Previous testimonials"
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-200",
                  canScroll.left
                    ? "hover:-translate-y-px hover:border-border-strong hover:text-foreground hover:shadow-subtle"
                    : "opacity-40",
                )}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={!canScroll.right}
                aria-label="Next testimonials"
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-200",
                  canScroll.right
                    ? "hover:-translate-y-px hover:border-border-strong hover:text-foreground hover:shadow-subtle"
                    : "opacity-40",
                )}
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="container-page relative pb-20 sm:pb-24">
        <div
          ref={railRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="region"
          aria-label="Customer testimonials, scrollable"
          tabIndex={0}
          className="rail-scroll flex cursor-grab snap-x snap-mandatory gap-5 overflow-x-auto pb-2 active:cursor-grabbing"
        >
          {testimonials.map((item) => (
            <article
              key={item.name}
              className="flex w-[290px] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-6 shadow-subtle transition-all duration-200 hover:-translate-y-[3px] hover:border-border-strong hover:shadow-card sm:w-[350px]"
            >
              <div className="flex gap-0.5 text-[var(--warning)]">
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="size-3.5 fill-current" strokeWidth={0} />
                ))}
              </div>
              <p className="mt-4 flex-1 text-pretty text-[15px] leading-relaxed text-foreground/90 select-none">
                &ldquo;{item.quote}&rdquo;
              </p>
              <footer className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                <Avatar name={item.name} size={36} />
                <div>
                  <p className="text-[13.5px] font-medium">{item.name}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {item.role} &middot; {item.company}
                  </p>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
