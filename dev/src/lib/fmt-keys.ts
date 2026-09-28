import { compact, inr, inrCompact, num } from "@/lib/format";

/** Serializable formatter keys (functions can't cross the server→client boundary). */
export type FmtKey = "number" | "inr" | "inrCompact" | "compact" | "percent" | "days";

export function applyFmt(key: FmtKey | undefined, n: number) {
  switch (key) {
    case "inr":
      return inr(n);
    case "inrCompact":
      return inrCompact(n);
    case "compact":
      return compact(n);
    case "percent":
      return `${Math.round(n)}%`;
    case "days":
      return `${Math.round(n)}d`;
    default:
      return num(Math.round(n));
  }
}
