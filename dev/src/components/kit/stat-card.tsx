import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { AnimatedNumber, HoverLift } from "@/components/kit/motion";
import { Delta } from "@/components/kit/badges";
import { cn } from "@/lib/utils";
import type { FmtKey } from "@/lib/fmt-keys";

export function StatCard({
  icon,
  label,
  value,
  fmt,
  delta,
  invertDelta,
  hint,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  fmt?: FmtKey;
  delta?: number | null;
  invertDelta?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <HoverLift className={cn("surface flex flex-col gap-3 p-4 sm:p-5", className)}>
      <span className="grid size-9 place-items-center rounded-[10px] border bg-card text-foreground/80 shadow-[var(--shadow-card)]">
        <AnimatedIcon icon={icon} className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <AnimatedNumber value={value} fmt={fmt} className="text-[26px] leading-none font-semibold tracking-[-0.02em]" />
          {delta != null && <Delta value={delta} invert={invertDelta} />}
        </div>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </HoverLift>
  );
}
