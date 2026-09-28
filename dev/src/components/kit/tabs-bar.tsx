"use client";

import * as React from "react";
import { motion } from "motion/react";
import type { IconComponent } from "@/components/icons";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { cn } from "@/lib/utils";

/** Underlined page tabs with a sliding indicator; syncs to ?tab= without navigation. */
export function TabsBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
  layoutId = "tabs-underline",
}: {
  tabs: { value: T; label: string; icon?: IconComponent; badge?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  layoutId?: string;
}) {
  return (
    <div role="tablist" className={cn("-mx-1 no-scrollbar flex gap-1 overflow-x-auto border-b px-1", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => {
              onChange(t.value);
              const url = new URL(window.location.href);
              url.searchParams.set("tab", t.value);
              window.history.replaceState(null, "", url);
            }}
            className={cn(
              "anim-host relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon && <AnimatedIcon icon={t.icon} className="size-4" />}
            {t.label}
            {t.badge}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** `initial` should come from the server's searchParams so SSR and client agree. */
export function useTabParam<T extends string>(initial: T, allowed: readonly T[]) {
  const [tab, setTab] = React.useState<T>(allowed.includes(initial) ? initial : allowed[0]);
  return [tab, setTab] as const;
}
