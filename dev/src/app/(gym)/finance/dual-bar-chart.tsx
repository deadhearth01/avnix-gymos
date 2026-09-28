"use client";

import { motion } from "motion/react";
import { inrCompact } from "@/lib/format";

export function DualBarChart({ months }: { months: { label: string; income: number; expenses: number }[] }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses]));
  return (
    <div role="img" aria-label="Income and expenses over the last twelve months" className="scrollbar-thin overflow-x-auto">
      <div className="flex h-64 min-w-[600px] items-end gap-2 pt-6 sm:gap-3">
        {months.map((m, i) => (
          <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1 border-b pb-px">
              <motion.div
                title={`${m.label} income: ${inrCompact(m.income)}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(m.income > 0 ? 2 : 0, (m.income / max) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.035 }}
                className="w-[38%] rounded-t-md bg-lime"
              />
              <motion.div
                title={`${m.label} expenses: ${inrCompact(m.expenses)}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(m.expenses > 0 ? 2 : 0, (m.expenses / max) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.035 + 0.08 }}
                className="w-[38%] rounded-t-md bg-rose-300 dark:bg-rose-500/60"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-lime" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-rose-300 dark:bg-rose-500/60" /> Expenses
        </span>
      </div>
    </div>
  );
}
