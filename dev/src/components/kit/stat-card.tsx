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
    <HoverLift className={cn("surface flex h-full flex-col gap-3 p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-[10px] border bg-card text-foreground/80 shadow-[var(--shadow-card)]">
          <AnimatedIcon icon={icon} className="size-[18px]" />
        </span>
        {delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.05 && <Delta value={delta} invert={invertDelta} />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] text-muted-foreground">{label}</p>
        <AnimatedNumber value={value} fmt={fmt} className="mt-1 block truncate text-[clamp(20px,2.1vw,26px)] leading-tight font-semibold tracking-[-0.02em]" />
        {hint && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </HoverLift>
  );
}
