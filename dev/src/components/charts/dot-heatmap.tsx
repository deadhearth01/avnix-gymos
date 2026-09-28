"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { applyFmt, type FmtKey } from "@/lib/fmt-keys";

/** GitHub-style activity grid in violet (the reference "Activity" block). */
export function DotHeatmap({
  cells,
  columns,
  rowLabels,
  colLabels,
  fmt = "number",
  className,
  tone = "violet",
}: {
  cells: { key: string; value: number; label: string }[];
  columns: number;
  rowLabels?: string[];
  colLabels?: string[];
  fmt?: FmtKey;
  className?: string;
  tone?: "violet" | "blue" | "green";
}) {
  const max = Math.max(1, ...cells.map((c) => c.value));
  const format = (v: number) => applyFmt(fmt, v);
  const base = tone === "violet" ? "124 58 237" : tone === "blue" ? "59 130 246" : "22 163 74";
  const rows = Math.ceil(cells.length / columns);
  return (
    <div className={cn("flex gap-2", className)}>
      {rowLabels && (
        <div className="grid shrink-0 text-[11px] text-subtle" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {rowLabels.map((l, i) => (
            <span key={`${l}-${i}`} className="flex items-center">
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {cells.map((c, i) => {
            const t = c.value / max;
            const bg = c.value === 0 ? "var(--track)" : `rgb(${base} / ${0.18 + t * 0.82})`;
            return (
              <Tooltip key={c.key}>
                <TooltipTrigger asChild>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min((i % columns) * 0.012 + Math.floor(i / columns) * 0.02, 0.6), type: "spring", stiffness: 300, damping: 20 }}
                    whileHover={{ scale: 1.35 }}
                    className="aspect-square rounded-[4px]"
                    style={{ background: bg }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-medium">{format(c.value)}</span> · {c.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {colLabels && (
          <div className="mt-2 flex justify-between text-[11px] text-subtle">
            {colLabels.map((l, i) => (
              <span key={`${l}-${i}`}>{l}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
