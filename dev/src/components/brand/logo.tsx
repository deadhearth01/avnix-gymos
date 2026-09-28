import { cn } from "@/lib/utils";

/**
 * GymOS mark: a weight plate drawn as an open ring, with the bar entering its
 * gap and out the other side — it reads as a plate on a barbell and as a G.
 * 48-unit grid, 7-unit stroke, round terminals. Works from 16px to billboard.
 */
export const MARK_ARC = "M31.95 11.28A15 15 0 1 0 38.85 26.09";
export const MARK_BAR = "M24 24H45";

export function LogoMark({ className, title = "GymOS" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("shrink-0", className)} role="img" aria-label={title}>
      <path d={MARK_ARC} stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d={MARK_BAR} stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <circle cx="24" cy="24" r="6" fill="currentColor" />
    </svg>
  );
}

/** Mark on a filled tile — app icon / favicon / sidebar badge. */
export function LogoTile({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[28%] bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <LogoMark className="size-[68%]" />
    </span>
  );
}

/** Horizontal lockup: mark + "GymOS" wordmark with the AvniX endorsement. */
export function Logo({ className, endorse = true, tone = "default" }: { className?: string; endorse?: boolean; tone?: "default" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", tone === "light" ? "text-white" : "text-foreground", className)}>
      <LogoMark className={cn("size-7", tone === "light" ? "text-white" : "text-primary")} />
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="font-display text-[19px] font-bold tracking-[-0.03em]">GymOS</span>
        {endorse && <span className={cn("text-[11px] font-medium", tone === "light" ? "text-white/60" : "text-muted-foreground")}>by AvniX</span>}
      </span>
    </span>
  );
}
