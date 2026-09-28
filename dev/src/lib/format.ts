import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { istDaysBetween } from "@/lib/domain/ist";

const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat("en-IN");
const compactFmt = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const inr = (n: number | null | undefined, exact = false) => (exact ? inrFmt2 : inrFmt).format(Number(n) || 0);
export const num = (n: number | null | undefined) => numFmt.format(Number(n) || 0);
export const compact = (n: number | null | undefined) => compactFmt.format(Number(n) || 0);
export const inrCompact = (n: number) => `₹${compactFmt.format(n)}`;

export function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? parseISO(v) : v;
  return isValid(d) ? d : null;
}
const TZ = "Asia/Kolkata";
const FMT: Record<string, Intl.DateTimeFormatOptions> = {
  "dd MMM yyyy": { day: "2-digit", month: "short", year: "numeric" },
  "dd MMM yy": { day: "2-digit", month: "short", year: "2-digit" },
  "dd MMM": { day: "2-digit", month: "short" },
  "h:mm a": { hour: "numeric", minute: "2-digit", hour12: true },
  "dd MMM yyyy, h:mm a": { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
};
const cache = new Map<string, Intl.DateTimeFormat>();

/** Always formats in IST so server (UTC) and browser render identical text — no hydration drift. */
export const fmtDate = (v: string | Date | null | undefined, pattern: keyof typeof FMT | string = "dd MMM yyyy") => {
  const d = toDate(v);
  if (!d) return "—";
  let f = cache.get(pattern);
  if (!f) {
    f = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...(FMT[pattern] ?? FMT["dd MMM yyyy"]) });
    cache.set(pattern, f);
  }
  return f
    .format(d)
    .replace("Sept", "Sep")
    .replace(/\bam\b/, "AM")
    .replace(/\bpm\b/, "PM");
};
export const fmtDateTime = (v: string | Date | null | undefined) => fmtDate(v, "dd MMM yyyy, h:mm a");
export const fmtTime = (v: string | Date | null | undefined) => fmtDate(v, "h:mm a");
export const ago = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "never";
};
export const daysUntil = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? istDaysBetween(new Date(), d) : null;
};

export function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function pct(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** +91 98765 43210 style display for Indian numbers */
export function fmtPhone(p: string | null | undefined) {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return p;
}

/** Normalise an Indian mobile to E.164 (+91XXXXXXXXXX). Returns null when invalid. */
export function toE164(p: string | null | undefined): string | null {
  if (!p) return null;
  let d = p.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  if (d.length === 12 && d.startsWith("91") && /^[6-9]/.test(d.slice(2))) return `+${d}`;
  if (p.trim().startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}
