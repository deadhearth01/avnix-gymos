"use client";

import { motion } from "motion/react";

/** Semicircle progress gauge. */
export function HalfGauge({
  value,
  max = 100,
  label,
  sub,
  color = "var(--primary)",
}: {
  value: number;
  max?: number;
  label: string;
  sub?: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = 80;
  const c = Math.PI * r;
  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <svg viewBox="0 0 200 112" className="w-full overflow-visible">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--track)" strokeWidth="16" strokeLinecap="round" />
        <motion.path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - pct) }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="tabular text-2xl font-semibold tracking-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
