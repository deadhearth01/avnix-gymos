"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Download, Loader2, Search, UsersRound, X } from "@/components/icons";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { attendanceLogAction, type DeskCheckin } from "../_actions/frontdesk";
import { METHODS, MethodBadge, methodKey, type MethodKey } from "./methods";

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
};
const dayHeading = (key: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${key}T12:00:00+05:30`))
    .replace("Sept", "Sep");
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

type Range = { from: string; to: string };
const PAGE = 250;

/**
 * Every check-in, filterable by day(s), person and mode — who came in, when, and how.
 */
export function AttendanceLog({ todayKey }: { todayKey: string }) {
  const presets: { label: string; range: Range }[] = [
    { label: "Today", range: { from: todayKey, to: todayKey } },
    { label: "Yesterday", range: { from: addDays(todayKey, -1), to: addDays(todayKey, -1) } },
    { label: "Last 7 days", range: { from: addDays(todayKey, -6), to: todayKey } },
    { label: "This month", range: { from: `${todayKey.slice(0, 8)}01`, to: todayKey } },
  ];
  const [range, setRange] = React.useState<Range>(presets[0].range);
  const [person, setPerson] = React.useState("");
  const [personQuery, setPersonQuery] = React.useState("");
  const [method, setMethod] = React.useState<MethodKey | "all">("all");
  const [rows, setRows] = React.useState<DeskCheckin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [capped, setCapped] = React.useState(false);
  const [shown, setShown] = React.useState(PAGE);
  const [loading, start] = React.useTransition();
  const req = React.useRef(0);

  // person filter waits until typing pauses
  React.useEffect(() => {
    const t = setTimeout(() => setPersonQuery(person.trim()), 350);
    return () => clearTimeout(t);
  }, [person]);

  React.useEffect(() => {
    const id = ++req.current;
    start(async () => {
      const r = await attendanceLogAction({ ...range, q: personQuery || undefined, method: method === "all" ? undefined : method }).catch(() => ({
        error: "The log couldn’t load. Check the internet connection and try again.",
      }));
      if (id !== req.current) return; // a newer filter won
      if ("error" in r) {
        setError(r.error);
        setRows([]);
        return;
      }
      setError(null);
      setRows(r.rows);
      setCapped(r.capped);
      setShown(PAGE);
    });
  }, [range, personQuery, method]);

  const list = React.useMemo(() => rows ?? [], [rows]);
  const people = React.useMemo(() => new Set(list.map((r) => r.memberId)).size, [list]);
  const byDay = React.useMemo(() => {
    const m = new Map<string, { n: number; people: Set<string> }>();
    for (const r of list) {
      const k = dayOf(r.at);
      const e = m.get(k) ?? { n: 0, people: new Set<string>() };
      e.n++;
      e.people.add(r.memberId);
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [list]);
  const byMethod = React.useMemo(() => {
    const m = new Map<MethodKey, number>();
    for (const r of list) m.set(methodKey(r.method), (m.get(methodKey(r.method)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);
  const maxDay = Math.max(1, ...byDay.map(([, v]) => v.n));
  const busiest = byDay.reduce<[string, { n: number }] | null>((a, b) => (!a || b[1].n > a[1].n ? b : a), null);
  const multiDay = range.from !== range.to;
  const activePreset = presets.find((p) => p.range.from === range.from && p.range.to === range.to)?.label;

  const exportCsv = () =>
    downloadCsv(`attendance_${range.from}_to_${range.to}.csv`, [
      ["Date", "Time", "Member", "Mode", "Recorded by"],
      ...list.map((r) => [dayOf(r.at), fmtTime(r.at), r.name, METHODS[methodKey(r.method)].label, r.by ?? ""]),
    ]);

  // rows grouped under day headings
  const visible = list.slice(0, shown);
  const groups: { day: string; items: DeskCheckin[] }[] = [];
  for (const r of visible) {
    const d = dayOf(r.at);
    const g = groups[groups.length - 1];
    if (g?.day === d) g.items.push(r);
    else groups.push({ day: d, items: [r] });
  }

  return (
    <div className="grid gap-4">
      {/* filters */}
      <div data-tour="log-filters" className="surface grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-[10px] bg-muted p-0.5 text-sm font-medium" role="radiogroup" aria-label="Date range">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                role="radio"
                aria-checked={activePreset === p.label}
                onClick={() => setRange(p.range)}
                className={cn(
                  "h-8 rounded-lg px-3 transition-colors",
                  activePreset === p.label ? "bg-card shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            <input
              type="date"
              aria-label="From date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
              className="h-9 rounded-lg border bg-card px-2"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              aria-label="To date"
              value={range.to}
              min={range.from}
              max={todayKey}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
              className="h-9 rounded-lg border bg-card px-2"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border bg-card px-3 focus-within:border-primary/60 sm:max-w-sm">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="One person — name or member number"
              aria-label="Filter by person"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {person && (
              <button type="button" aria-label="Clear person filter" onClick={() => setPerson("")} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
          <select
            aria-label="Filter by mode"
            value={method}
            onChange={(e) => setMethod(e.target.value as MethodKey | "all")}
            className="h-10 rounded-[10px] border bg-card px-3 text-sm"
          >
            <option value="all">All modes</option>
            {(["manual", "qr", "face", "fingerprint", "card", "kiosk"] as MethodKey[]).map((k) => (
              <option key={k} value={k}>
                {METHODS[k].label}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={exportCsv} disabled={!list.length} className="ml-auto">
            <Download /> Download CSV
          </Button>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Check-ins" value={rows ? list.length.toLocaleString("en-IN") : "—"} />
        <Stat label="Different people" value={rows ? people.toLocaleString("en-IN") : "—"} icon={UsersRound} />
        <Stat label={multiDay ? "Busiest day" : "Day"} value={busiest ? `${busiest[1].n}` : "—"} hint={busiest ? dayHeading(busiest[0]) : undefined} />
        <Stat
          label="Most used mode"
          value={byMethod[0] ? METHODS[byMethod[0][0]].label : "—"}
          hint={byMethod[0] ? `${Math.round((byMethod[0][1] / Math.max(1, list.length)) * 100)}% of check-ins` : undefined}
        />
      </div>

      <div className={cn("grid gap-4", multiDay && "xl:grid-cols-[320px_minmax(0,1fr)]")}>
        {multiDay && (
          <div className="surface self-start p-5">
            <p className="text-[15px] font-semibold">Day by day</p>
            <p className="text-xs text-muted-foreground">Tap a day to see only that day.</p>
            <ul className="mt-3 grid gap-1.5">
              {byDay.map(([d, v]) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => setRange({ from: d, to: d })}
                    className="group grid w-full gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{dayHeading(d)}</span>
                      <span className="tabular text-muted-foreground">
                        {v.n} · {v.people.size} people
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-track">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(v.n / maxDay) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
              {byDay.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No check-ins in this range.</li>}
            </ul>
          </div>
        )}

        <div data-tour="log-table" className="surface min-w-0 p-2 sm:p-3">
          {rows === null || (loading && !list.length) ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading the log…
            </p>
          ) : error ? (
            <p className="py-16 text-center text-sm text-destructive">{error}</p>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {personQuery ? `No check-ins for “${personQuery}” in this range.` : "No check-ins in this range."}
            </p>
          ) : (
            <div className={cn("transition-opacity", loading && "opacity-50")}>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>Time</th>
                    <th>Member</th>
                    <th>Mode</th>
                    <th>Recorded by</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.day}>
                    <tr>
                      <th colSpan={4} scope="colgroup" className="sticky top-0 z-[1] bg-card/95 px-3 pt-4 pb-2 text-left backdrop-blur">
                        <span className="text-[13px] font-semibold">{dayHeading(g.day)}</span>
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {byDay.find(([d]) => d === g.day)?.[1].n ?? g.items.length} check-ins
                        </span>
                      </th>
                    </tr>
                    {g.items.map((r) => (
                      <tr key={r.id} className="border-t border-border/60 hover:bg-muted/40">
                        <td className="tabular w-24 px-3 py-2.5 text-muted-foreground">{fmtTime(r.at)}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/members/${r.memberId}`} className="inline-flex items-center gap-2.5 font-medium hover:underline">
                            <PersonAvatar name={r.name} size={26} />
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <MethodBadge method={r.method} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
              {list.length > shown && (
                <div className="p-3 text-center">
                  <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                    Show more ({(list.length - shown).toLocaleString("en-IN")} left)
                  </Button>
                </div>
              )}
              {capped && (
                <p className="p-3 text-center text-xs text-muted-foreground">Showing the latest 5,000 check-ins — pick a shorter range to see everything.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon?: typeof UsersRound }) {
  return (
    <div className="surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
