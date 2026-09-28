/**
 * Calendar math pinned to Asia/Kolkata (IST, UTC+05:30, no DST) so results
 * are identical on a UTC server and an IST laptop.
 */
const OFFSET = 330 * 60_000;
const DAY = 86_400_000;

/** IST calendar day as YYYY-MM-DD */
export function istYmd(d: Date | string | number = new Date()) {
  return new Date(new Date(d).getTime() + OFFSET).toISOString().slice(0, 10);
}
/** Day number (days since epoch) of the IST calendar date. */
export function istDayNum(d: Date | string | number = new Date()) {
  return Math.floor((new Date(d).getTime() + OFFSET) / DAY);
}
/** 00:00:00.000 IST of the IST calendar day containing `d`. */
export function istStartOfDay(d: Date | string | number = new Date()) {
  return new Date(istDayNum(d) * DAY - OFFSET);
}
/** 23:59:59.999 IST of that day. */
export function istEndOfDay(d: Date | string | number = new Date()) {
  return new Date(istStartOfDay(d).getTime() + DAY - 1);
}
export function istAddDays(d: Date | string | number, days: number) {
  return new Date(new Date(d).getTime() + days * DAY);
}
/** Parse a date-only string ("2026-10-01") as that IST calendar day; ISO datetimes pass through. */
export function parseIstDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+05:30`) : new Date(v);
}
/** Whole IST calendar days from a to b (b - a). */
export function istDaysBetween(a: Date | string, b: Date | string) {
  return istDayNum(b) - istDayNum(a);
}
