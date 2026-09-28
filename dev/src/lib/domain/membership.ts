import type { Tone } from "@/components/kit/badges";
import type { Member } from "@/lib/types";
import { istAddDays, istDaysBetween, istEndOfDay, istStartOfDay, istYmd } from "./ist";

export const EXPIRING_WINDOW_DAYS = 7;

export type LiveStatus = "active" | "upcoming" | "expiring" | "expired" | "frozen" | "cancelled" | "none";

/** Effective status right now, evaluated on IST calendar days. */
export function liveStatus(m: Pick<Member, "status" | "expiresAt"> & { startAt?: string | null }, now = new Date()): LiveStatus {
  if (m.status === "frozen") return "frozen";
  if (m.status === "cancelled") return "cancelled";
  if (!m.expiresAt) return "none";
  if (new Date(m.expiresAt) < now) return "expired";
  if (m.startAt && new Date(m.startAt) > now) return "upcoming";
  const days = istDaysBetween(now, m.expiresAt);
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "active";
}

/** Statuses that may enter the gym. */
export const CAN_ENTER: LiveStatus[] = ["active", "expiring"];

export const STATUS_META: Record<LiveStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  upcoming: { label: "Starts soon", tone: "violet" },
  expiring: { label: "Expiring", tone: "amber" },
  expired: { label: "Expired", tone: "red" },
  frozen: { label: "Frozen", tone: "blue" },
  cancelled: { label: "Cancelled", tone: "gray" },
  none: { label: "No plan", tone: "gray" },
};

/** Inclusive plan window: starts 00:00 IST on `start`'s day, ends 23:59:59.999 IST on day start+duration-1. */
export function membershipEnd(start: Date, durationDays: number) {
  return istEndOfDay(istAddDays(istStartOfDay(start), Math.max(1, durationDays) - 1));
}

/** Renewal starts the IST day after the current expiry if it hasn't lapsed, else today. */
export function renewalStart(currentExpiry: string | null | undefined, now = new Date()) {
  if (currentExpiry) {
    const exp = new Date(currentExpiry);
    if (exp >= istStartOfDay(now)) return istStartOfDay(istAddDays(exp, 1));
  }
  return istStartOfDay(now);
}

/** IST calendar day key (YYYY-MM-DD). */
export const dayKey = (d = new Date()) => istYmd(d);
