"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { applyFmt, type FmtKey } from "@/lib/fmt-keys";

type Datum = { label: string; value: number; sub?: string };

/** Lime bars over soft grey tracks — the reference "earnings" chart. */
export function BarTrackChart({
  data,
  fmt = "number",
  height = 220,
  highlightLast = true,
  className,
  color = "var(--lime)",
}: {
  data: Datum[];
  fmt?: FmtKey;
  height?: number;
  highlightLast?: boolean;
  className?: string;
  color?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const format = (n: number) => applyFmt(fmt, n);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const ticks = [nice, nice * 0.66, nice * 0.33, 0];

  return (
    <div className={cn("relative flex gap-3", className)} style={{ height }}>
      <div className="tabular flex flex-col justify-between pb-6 text-right text-[11px] text-subtle">
        {ticks.map((t) => (
          <span key={t}>{format(t)}</span>
        ))}
      </div>
      <div className="relative flex flex-1 items-end gap-[6px] sm:gap-2">
        {data.map((d, i) => {
          const pct = (d.value / nice) * 100;
          const isHot = hover === i || (hover === null && highlightLast && i === data.length - 1);
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex h-full flex-1 flex-col items-center gap-2"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="relative w-full flex-1 overflow-hidden rounded-[8px] bg-track">
                <motion.div
                  initial={{ height: 0 }}
                  whileInView={{ height: `${Math.max(pct, d.value > 0 ? 3 : 0)}%` }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 110, damping: 18, delay: i * 0.035 }}
                  className="absolute inset-x-0 bottom-0 rounded-[8px] transition-[filter] duration-200"
                  style={{ background: color, filter: isHot ? "saturate(1.15) brightness(1.02)" : hover !== null ? "saturate(0.7) opacity(0.65)" : undefined }}
                />
              </div>
              <span className={cn("text-[11px] text-muted-foreground transition-colors", isHot && "text-foreground")}>{d.label}</span>
              {hover === i && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-[var(--shadow-float)]"
                >
                  <p className="tabular font-semibold">{format(d.value)}</p>
                  <p className="text-muted-foreground">{d.sub ?? d.label}</p>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function niceMax(n: number) {
  if (n <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}
