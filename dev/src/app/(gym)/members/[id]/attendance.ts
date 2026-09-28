import { addDays, subDays } from "date-fns";

const TZ = "Asia/Kolkata";
const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const label = (d: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" }).format(d);

/** 17-week attendance grid + habit stats, computed on the server. */
export function attendanceSummary(isoTimes: string[], now = new Date()) {
  const days = new Map<string, number>();
  for (const t of isoTimes) {
    const k = key(new Date(t));
    days.set(k, (days.get(k) ?? 0) + 1);
  }
  const weeks = 17;
  const startMonday = subDays(now, ((now.getDay() + 6) % 7) + (weeks - 1) * 7);
  const cells: { key: string; value: number; label: string }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    for (let w = 0; w < weeks; w++) {
      const d = addDays(startMonday, w * 7 + wd);
      cells.push({ key: `${w}-${wd}`, value: d > now ? 0 : Math.min(1, days.get(key(d)) ?? 0), label: label(d) });
    }
  }
  // streak (consecutive days, allowing Sundays off)
  let streak = 0;
  for (let i = 0; i < 120; i++) {
    const d = subDays(now, i);
    if (days.has(key(d))) streak++;
    else if (i === 0 || d.getDay() === 0) continue;
    else break;
  }
  const inLast = (n: number) => [...days.keys()].filter((k) => k >= key(subDays(now, n - 1))).length;
  return {
    cells,
    columns: weeks,
    last30: inLast(30),
    perWeek: Math.round((inLast(56) / 8) * 10) / 10,
    streak,
    total120: days.size,
  };
}

export function planProgress(startIso: string, endIso: string, now = Date.now()) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!(end > start)) return 100;
  return Math.round(Math.min(1, Math.max(0, (now - start) / (end - start))) * 1000) / 10;
}
