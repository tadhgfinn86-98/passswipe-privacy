"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  CalendarDays,
  FolderOpen,
  GitBranch,
  Mail,
  MessageSquare,
  Plug,
  NotebookPen,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

type Integration = {
  name: string;
  detail: string;
  icon: LucideIcon;
  angle: number;
};

const integrations: Integration[] = [
  { name: "Slack", detail: "Post updates & take requests", icon: MessageSquare, angle: -90 },
  { name: "Gmail", detail: "Triage and draft replies", icon: Mail, angle: -38 },
  { name: "Notion", detail: "Keep docs in sync", icon: NotebookPen, angle: 13 },
  { name: "Calendar", detail: "Find and book time", icon: CalendarDays, angle: 64 },
  { name: "HubSpot", detail: "Update deals automatically", icon: Users, angle: 116 },
  { name: "GitHub", detail: "Track issues and releases", icon: GitBranch, angle: 167 },
  { name: "Drive", detail: "Collect and file assets", icon: FolderOpen, angle: 218 },
];

const RADIUS = 39;

function position(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 50 + RADIUS * Math.cos(radians),
    y: 50 + RADIUS * Math.sin(radians),
  };
}

export function Integrations() {
  const [active, setActive] = React.useState<string | null>(null);
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Plug className="size-3.5 text-[var(--brand)]" />
          <span className="text-[13px] font-medium">Connected tools</span>
        </div>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
          7 of 40+ active
        </span>
      </div>

      <div className="relative px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative mx-auto aspect-square w-full max-w-[380px] sm:max-w-[440px]">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_58%)]"
      />

      {/* Orbit rings */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 size-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border"
      />

      {/* Connection lines */}
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        {integrations.map((item) => {
          const { x, y } = position(item.angle);
          const isActive = active === item.name;
          return (
            <g key={item.name}>
              <line
                x1="50"
                y1="50"
                x2={x}
                y2={y}
                stroke="var(--border-strong)"
                strokeWidth="0.35"
              />
              <line
                x1="50"
                y1="50"
                x2={x}
                y2={y}
                stroke="var(--brand)"
                strokeWidth={isActive ? 0.7 : 0.45}
                strokeDasharray="2 4"
                strokeLinecap="round"
                className={cn(
                  "transition-opacity duration-300",
                  reduce ? "" : "animate-dash-flow",
                  isActive ? "opacity-100" : "opacity-35",
                )}
                style={{ animationDuration: isActive ? "0.8s" : "2s" }}
              />
            </g>
          );
        })}
      </svg>

      {/* Centre agent */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          {!reduce ? (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl bg-[var(--brand)]/25"
              animate={{ scale: [1, 1.5], opacity: [0.45, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
            />
          ) : null}
          <div className="relative flex size-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card shadow-raised sm:size-20">
            <LogoMark className="size-7 sm:size-8" />
            <span className="text-[9.5px] font-medium tracking-tight text-subtle-foreground">
              SkyAgent
            </span>
          </div>
        </div>
      </div>

      {/* Integration nodes */}
      {integrations.map((item, index) => {
        const { x, y } = position(item.angle);
        const Icon = item.icon;
        const isActive = active === item.name;
        return (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <button
              type="button"
              onMouseEnter={() => setActive(item.name)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(item.name)}
              onBlur={() => setActive(null)}
              aria-label={`${item.name}: ${item.detail}`}
              className={cn(
                "group relative flex size-12 items-center justify-center rounded-xl border bg-card transition-all duration-200 sm:size-14",
                isActive
                  ? "-translate-y-0.5 scale-105 border-[var(--brand)] text-[var(--brand)] shadow-raised"
                  : "border-border text-muted-foreground shadow-subtle",
              )}
            >
              <Icon className="size-5 sm:size-[22px]" strokeWidth={1.7} />
            </button>

            <span
              className={cn(
                "pointer-events-none absolute left-1/2 top-[calc(100%+6px)] w-max -translate-x-1/2 text-[11px] font-medium transition-colors duration-200",
                isActive ? "text-foreground" : "text-subtle-foreground",
              )}
            >
              {item.name}
            </span>

            <span
              role="tooltip"
              className={cn(
                "pointer-events-none absolute left-1/2 top-[calc(100%+26px)] z-10 w-max max-w-[150px] -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-center text-[10.5px] leading-tight text-muted-foreground shadow-card transition-all duration-200",
                isActive ? "opacity-100" : "translate-y-1 opacity-0",
              )}
            >
              {item.detail}
            </span>
          </motion.div>
        );
      })}
        </div>
      </div>
    </div>
  );
}
