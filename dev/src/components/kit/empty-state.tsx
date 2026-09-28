import * as React from "react";
import type { IconComponent } from "@/components/icons";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: IconComponent;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("anim-host flex flex-col items-center justify-center text-center", compact ? "gap-2 py-8" : "gap-3 py-14", className)}>
      <div className="relative">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-primary/10 blur-xl" />
        <span className="grid size-12 place-items-center rounded-2xl border bg-card text-primary shadow-[var(--shadow-float)]">
          <AnimatedIcon icon={icon} className="size-5" />
        </span>
      </div>
      <div className="max-w-sm">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
