"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: React.ReactNode };

/** Weekly / Monthly / Yearly style pill switcher with a sliding thumb. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className,
  layoutId,
  stretch,
}: {
  stretch?: boolean;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
  layoutId?: string;
}) {
  const id = React.useId();
  return (
    <div role="tablist" className={cn("items-center rounded-[10px] bg-muted/80 p-0.5", stretch ? "flex w-full" : "inline-flex", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-lg font-medium whitespace-nowrap transition-colors duration-200",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              size === "xs" && "h-6 px-2 text-xs",
              size === "sm" && "h-7 px-2.5 text-[13px]",
              size === "md" && "h-9 px-3 text-sm",
              stretch && "min-w-0 flex-1 px-1",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId ?? `seg-${id}`}
                className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.03)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
