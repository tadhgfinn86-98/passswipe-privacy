"use client";

import * as React from "react";
import { motion, useInView } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowUpRight, CalendarRange, Clock4, Gauge, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type RangeKey = "7d" | "30d" | "90d";

const ranges: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const dataset: Record<
  RangeKey,
  {
    kpis: { label: string; value: string; delta: string; icon: typeof Zap }[];
    line: number[];
    lineLabels: string[];
    bars: { label: string; value: number }[];
    breakdown: { label: string; value: number; tone: string }[];
  }
> = {
  "7d": {
    kpis: [
      { label: "Tasks automated", value: "1,234", delta: "+18.2%", icon: Zap },
      { label: "Time saved", value: "42.8h", delta: "+9.4%", icon: Clock4 },
      { label: "Automation success", value: "94%", delta: "+1.8%", icon: Gauge },
    ],
    line: [38, 44, 41, 58, 66, 61, 78],
    lineLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    bars: [
      { label: "M", value: 52 },
      { label: "T", value: 68 },
      { label: "W", value: 61 },
      { label: "T", value: 86 },
      { label: "F", value: 74 },
      { label: "S", value: 33 },
      { label: "S", value: 28 },
    ],
    breakdown: [
      { label: "Scheduling", value: 42, tone: "var(--brand)" },
      { label: "Inbox triage", value: 31, tone: "var(--accent-sky)" },
      { label: "CRM updates", value: 17, tone: "var(--success)" },
      { label: "Reporting", value: 10, tone: "var(--warning)" },
    ],
  },
  "30d": {
    kpis: [
      { label: "Tasks automated", value: "5,482", delta: "+24.6%", icon: Zap },
      { label: "Time saved", value: "186h", delta: "+12.1%", icon: Clock4 },
      { label: "Automation success", value: "96%", delta: "+2.4%", icon: Gauge },
    ],
    line: [30, 42, 39, 55, 52, 71, 68, 84, 79, 92],
    lineLabels: ["W1", "W1", "W2", "W2", "W3", "W3", "W4", "W4", "W5", "W5"],
    bars: [
      { label: "W1", value: 44 },
      { label: "W2", value: 63 },
      { label: "W3", value: 71 },
      { label: "W4", value: 88 },
      { label: "W5", value: 96 },
    ],
    breakdown: [
      { label: "Scheduling", value: 38, tone: "var(--brand)" },
      { label: "Inbox triage", value: 27, tone: "var(--accent-sky)" },
      { label: "CRM updates", value: 24, tone: "var(--success)" },
      { label: "Reporting", value: 11, tone: "var(--warning)" },
    ],
  },
  "90d": {
    kpis: [
      { label: "Tasks automated", value: "17.9k", delta: "+41.3%", icon: Zap },
      { label: "Time saved", value: "612h", delta: "+28.7%", icon: Clock4 },
      { label: "Automation success", value: "97%", delta: "+3.1%", icon: Gauge },
    ],
    line: [22, 34, 31, 46, 58, 54, 69, 76, 72, 88, 94, 99],
    lineLabels: ["Apr", "Apr", "May", "May", "May", "Jun", "Jun", "Jun", "Jul", "Jul", "Aug", "Aug"],
    bars: [
      { label: "Apr", value: 38 },
      { label: "May", value: 57 },
      { label: "Jun", value: 74 },
      { label: "Jul", value: 89 },
      { label: "Aug", value: 98 },
    ],
    breakdown: [
      { label: "Scheduling", value: 34, tone: "var(--brand)" },
      { label: "Inbox triage", value: 29, tone: "var(--accent-sky)" },
      { label: "CRM updates", value: 25, tone: "var(--success)" },
      { label: "Reporting", value: 12, tone: "var(--warning)" },
    ],
  },
};

const VIEW_W = 600;
const VIEW_H = 200;
const PAD_Y = 26;

function buildPath(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * VIEW_W;
    const y =
      VIEW_H - PAD_Y - ((value - min) / span) * (VIEW_H - PAD_Y * 2);
    return { x, y };
  });

  const line = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const controlX = (previous.x + point.x) / 2;
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");

  return { line, area: `${line} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`, points };
}

export function AnalyticsDemo() {
  const [range, setRange] = React.useState<RangeKey>("7d");
  const [hover, setHover] = React.useState<number | null>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { amount: 0.25, once: true });
  const reduce = useReducedMotion();

  const data = dataset[range];
  const { line, area, points } = React.useMemo(() => buildPath(data.line), [data.line]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setHover(Math.round(ratio * (data.line.length - 1)));
  }

  const maxBar = Math.max(...data.bars.map((bar) => bar.value));

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-3.5 text-subtle-foreground" />
          <span className="text-[13px] font-medium">Automation overview</span>
        </div>
        <div
          role="group"
          aria-label="Select date range"
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
        >
          {ranges.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              aria-pressed={range === item.key}
              className={cn(
                "relative rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                range === item.key
                  ? "text-foreground"
                  : "text-subtle-foreground hover:text-foreground",
              )}
            >
              {range === item.key ? (
                <motion.span
                  layoutId="range-pill"
                  className="absolute inset-0 rounded-md bg-card-muted"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : null}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* KPI cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {data.kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={kpi.label}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="rounded-xl border border-border bg-surface p-3.5 transition-all duration-200 hover:-translate-y-[2px] hover:border-border-strong hover:shadow-subtle"
              >
                <div className="flex items-center justify-between">
                  <Icon className="size-3.5 text-subtle-foreground" strokeWidth={1.8} />
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-[color-mix(in_oklab,var(--success)_12%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--success)]">
                    <ArrowUpRight className="size-2.5" strokeWidth={2.4} />
                    {kpi.delta}
                  </span>
                </div>
                <p className="mt-2.5 text-[26px] font-semibold tracking-[-0.03em] tabular-nums">
                  {kpi.value}
                </p>
                <p className="text-[12px] text-muted-foreground">{kpi.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Line chart */}
        <div className="mt-3 rounded-xl border border-border bg-surface p-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[12.5px] font-medium">Tasks completed by agent</p>
            <p className="font-mono text-[11.5px] tabular-nums text-subtle-foreground">
              {hover !== null ? `${data.lineLabels[hover]} · ${data.line[hover]}` : "Live"}
            </p>
          </div>

          <div
            ref={chartRef}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
            className="relative mt-3 h-[150px] w-full touch-none sm:h-[180px]"
          >
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              className="size-full"
            >
              <defs>
                <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((position) => (
                <line
                  key={position}
                  x1="0"
                  x2={VIEW_W}
                  y1={VIEW_H * position}
                  y2={VIEW_H * position}
                  stroke="var(--border)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <motion.path
                key={`area-${range}`}
                d={area}
                fill="url(#chart-area)"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{ duration: 0.8, delay: 0.25 }}
              />
              <motion.path
                key={`line-${range}`}
                d={line}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : undefined}
                transition={{ duration: reduce ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>

            {/* Hover marker rendered in DOM so it never distorts */}
            {hover !== null ? (
              <>
                <span
                  className="pointer-events-none absolute top-0 h-full w-px bg-border-strong"
                  style={{ left: `${(points[hover].x / VIEW_W) * 100}%` }}
                />
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand)] ring-4 ring-[var(--brand-soft)]"
                  style={{
                    left: `${(points[hover].x / VIEW_W) * 100}%`,
                    top: `${(points[hover].y / VIEW_H) * 100}%`,
                  }}
                />
              </>
            ) : null}
          </div>

          <div className="mt-2 flex justify-between font-mono text-[10.5px] text-subtle-foreground">
            {data.lineLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className={cn(
                  index > 0 && index < data.lineLabels.length - 1 && "hidden sm:inline",
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Bars + breakdown */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-3.5">
            <p className="text-[12.5px] font-medium">Runs per period</p>
            <div className="mt-4 flex h-[124px] gap-2">
              {data.bars.map((bar, index) => (
                <div
                  key={`${bar.label}-${index}`}
                  className="group flex h-full flex-1 flex-col items-center gap-2"
                >
                  <div className="relative flex w-full flex-1 items-end">
                    <motion.div
                      initial={reduce ? { height: `${(bar.value / maxBar) * 100}%` } : { height: 0 }}
                      animate={inView ? { height: `${(bar.value / maxBar) * 100}%` } : undefined}
                      transition={{
                        duration: 0.7,
                        delay: 0.15 + index * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="w-full rounded-t-md bg-[color-mix(in_oklab,var(--brand)_28%,transparent)] transition-colors duration-200 group-hover:bg-[var(--brand)]"
                    />
                    <span className="pointer-events-none absolute inset-x-0 -top-5 text-center font-mono text-[10px] tabular-nums text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {bar.value}
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-subtle-foreground">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-3.5">
            <p className="text-[12.5px] font-medium">Activity by category</p>
            <ul className="mt-4 flex flex-col gap-3">
              {data.breakdown.map((item, index) => (
                <li key={item.label}>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono tabular-nums text-subtle-foreground">
                      {item.value}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card-muted">
                    <motion.div
                      initial={reduce ? { width: `${item.value}%` } : { width: 0 }}
                      animate={inView ? { width: `${item.value}%` } : undefined}
                      transition={{
                        duration: 0.8,
                        delay: 0.2 + index * 0.08,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="h-full rounded-full"
                      style={{ background: item.tone }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
