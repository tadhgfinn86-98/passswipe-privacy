"use client";

import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

const companies = [
  "Northstar",
  "Arc",
  "Linear Labs",
  "Meridian",
  "Vertex",
  "Orbit",
  "Nova",
  "Lumen",
];

function Wordmark({ name }: { name: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 px-6 sm:px-8">
      <span
        aria-hidden="true"
        className="size-2.5 rotate-45 rounded-[3px] border border-current opacity-70"
      />
      <span className="text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-[17px]">
        {name}
      </span>
    </span>
  );
}

export function TrustedBy() {
  return (
    <section aria-labelledby="trusted-by-title" className="border-y border-border bg-surface">
      <div className="container-page py-10 sm:py-12">
        <Reveal>
          <h2
            id="trusted-by-title"
            className="text-center text-[12px] font-medium uppercase tracking-[0.14em] text-subtle-foreground"
          >
            Trusted by fast-growing teams
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="pause-on-hover relative mt-7 overflow-hidden mask-fade-x">
            <div
              className={cn(
                "flex w-max animate-marquee-x items-center text-muted-foreground/70",
              )}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
                  {companies.map((name) => (
                    <Wordmark key={`${copy}-${name}`} name={name} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
