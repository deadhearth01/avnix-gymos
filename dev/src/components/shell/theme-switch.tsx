"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { cn } from "@/lib/utils";

export function ThemeSwitch({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";

  const set = (t: "light" | "dark") => {
    const apply = () => setTheme(t);
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  };

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => set(dark ? "light" : "dark")}
        className="anim-host grid size-9 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <AnimatedIcon icon={dark ? Moon : Sun} className="size-[18px]" />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full bg-muted/80 p-0.5">
      {(["light", "dark"] as const).map((t) => {
        const active = mounted && (t === "dark") === dark;
        const Icon = t === "light" ? Sun : Moon;
        return (
          <button
            key={t}
            role="radio"
            aria-checked={active}
            aria-label={`${t} theme`}
            type="button"
            onClick={() => set(t)}
            className={cn(
              "anim-host relative grid size-8 place-items-center rounded-full transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && <motion.span layoutId="theme-thumb" className="absolute inset-0 rounded-full bg-card shadow-[0_1px_3px_rgb(0_0_0/0.12)]" />}
            <span className="relative z-10">
              <AnimatedIcon icon={Icon} className="size-4" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
