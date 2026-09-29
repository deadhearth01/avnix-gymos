"use client";

import * as React from "react";
import { Check, RefreshCw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LOGO_NAMES, LOGO_PRESETS, logoPreset, presetUrl, type LogoPreset } from "@/lib/site/presets";

/** Grid of illustrated default logos. `value` is a preset id ("preset:logo-panda") or anything else (= none selected). */
export function LogoPicker({
  value,
  onChange,
  color,
  disabled,
  size = 52,
}: {
  value: string | null | undefined;
  onChange: (preset: string) => void;
  color?: string | null;
  disabled?: boolean;
  size?: number;
}) {
  const shuffle = () => {
    const others = LOGO_NAMES.filter((n) => logoPreset(n) !== value);
    onChange(logoPreset(others[Math.floor(Math.random() * others.length)]));
  };
  const tint = `color-mix(in oklab, ${color || "var(--primary)"} 22%, white)`;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Default logo">
        {LOGO_NAMES.map((n: LogoPreset) => {
          const id = logoPreset(n);
          const on = value === id;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={LOGO_PRESETS[n]}
              title={LOGO_PRESETS[n]}
              disabled={disabled}
              onClick={() => onChange(id)}
              className={cn(
                "relative grid place-items-center rounded-xl ring-offset-2 ring-offset-card transition-[box-shadow,transform] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50",
                on ? "ring-2 ring-primary" : "ring-1 ring-border",
              )}
              style={{ width: size, height: size, background: tint }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={presetUrl(id) ?? undefined} alt="" className="size-[84%] object-contain" />
              {on && (
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
            </button>
          );
        })}
        <Button type="button" variant="ghost" size="sm" onClick={shuffle} disabled={disabled}>
          <RefreshCw /> Shuffle
        </Button>
      </div>
    </div>
  );
}
