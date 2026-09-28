import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "green" | "lime" | "red" | "amber" | "blue" | "violet" | "gray";

const SOFT: Record<Tone, string> = {
  green: "bg-success-soft text-success-ink",
  lime: "bg-lime-soft text-lime-ink",
  red: "bg-danger-soft text-danger-ink",
  amber: "bg-warning-soft text-warning-ink",
  blue: "bg-info-soft text-info-ink",
  violet: "bg-violet-soft text-violet-ink",
  gray: "bg-muted text-muted-foreground",
};
const DOT: Record<Tone, string> = {
  green: "bg-success",
  lime: "bg-lime",
  red: "bg-destructive",
  amber: "bg-warning",
  blue: "bg-info",
  violet: "bg-violet",
  gray: "bg-subtle",
};

/** Soft rectangular tag, e.g. "Delivery failed", "Shipped". */
export function Tag({ tone = "gray", className, children, ...props }: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap", SOFT[tone], className)} {...props}>
      {children}
    </span>
  );
}

/** Dot + label, e.g. "● Completed". */
export function StatusDot({ tone = "gray", pulse, className, children }: { tone?: Tone; pulse?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm whitespace-nowrap", className)}>
      <span className="relative flex size-2">
        {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", DOT[tone])} />}
        <span className={cn("relative inline-flex size-2 rounded-full", DOT[tone])} />
      </span>
      {children}
    </span>
  );
}

/** "+9.4%" / "-2.1%" change chip used in KPI cards. */
export function Delta({ value, suffix = "%", invert = false, className }: { value: number; suffix?: string; invert?: boolean; className?: string }) {
  const rounded = Math.round(value * 10) / 10;
  const good = invert ? rounded < 0 : rounded > 0;
  const tone: Tone = rounded === 0 ? "gray" : good ? "lime" : "red";
  return (
    <Tag tone={tone} className={cn("tabular h-[22px] rounded-md px-1.5 text-[12px] font-semibold", className)}>
      {rounded > 0 ? "+" : ""}
      {rounded.toFixed(1)}
      {suffix}
    </Tag>
  );
}

export const toneDot = DOT;
export const toneSoft = SOFT;
