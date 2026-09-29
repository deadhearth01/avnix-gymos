"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Info, Keyboard, Loader2, QrCode, ScanFace, ScanLine, Search, X } from "@/components/icons";
import { PageHeader } from "@/components/kit/page-header";
import { TabsBar, useTabParam } from "@/components/kit/tabs-bar";
import { AttendanceLog } from "./attendance-log";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { StatusDot, Tag } from "@/components/kit/badges";
import { LiveDot, useLiveEvents, usePollWhenNotLive } from "@/components/realtime/realtime-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/domain/membership";
import { daysUntil, fmtDate, fmtPhone, fmtTime, inr } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { METHODS, MethodBadge, howText, methodKey, methodOf, type MethodKey } from "./methods";
import { checkinDetailAction, checkInAction, deskDayAction, deskSearchAction, type DeskCheckin, type DeskMember } from "../_actions/frontdesk";

type TodayItem = DeskCheckin;
type Result = {
  name: string;
  memberId: string;
  status: DeskMember["status"];
  balanceDue: number;
  expiresAt: string | null;
  visitCount: number;
  duplicate: boolean;
  blocked: boolean;
};

/* ─────────────────────────── per-computer display preferences ─────────────────────────── */

const PREF_KEY = "gymos:desk-hours";
const PRESETS = [
  { label: "Gym hours", from: 5, to: 23 },
  { label: "Morning", from: 5, to: 12 },
  { label: "Evening", from: 16, to: 23 },
  { label: "All day", from: 0, to: 24 },
];
const DEFAULT_RANGE = { from: 5, to: 23 };

function subscribePrefs(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("gymos:prefs", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("gymos:prefs", cb);
  };
}
function readPrefs() {
  try {
    return localStorage.getItem(PREF_KEY) ?? "";
  } catch {
    return "";
  }
}
function useHourRange() {
  const raw = React.useSyncExternalStore(subscribePrefs, readPrefs, () => "");
  const range = React.useMemo(() => {
    try {
      const v = JSON.parse(raw) as { from: number; to: number };
      return v.from >= 0 && v.to <= 24 && v.to > v.from ? v : DEFAULT_RANGE;
    } catch {
      return DEFAULT_RANGE;
    }
  }, [raw]);
  const set = (v: { from: number; to: number }) => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(v));
    } catch {
      /* per-computer convenience only */
    }
    window.dispatchEvent(new Event("gymos:prefs"));
  };
  return [range, set] as const;
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;
const shortHour = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
const istHour = (iso: string) =>
  Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
};
const dayTitle = (key: string, today: string) =>
  key === today ? "Today" : key === addDays(today, -1) ? "Yesterday" : fmtDate(`${key}T12:00:00+05:30`, "dd MMM yyyy");

/* ─────────────────────────── page ─────────────────────────── */

export function FrontDesk({
  gymName,
  today: initial,
  total,
  todayKey,
  initialTab = "desk",
}: {
  gymName: string;
  today: TodayItem[];
  total: number;
  todayKey: string;
  initialTab?: string;
}) {
  const [tab, setTab] = useTabParam(initialTab as "desk" | "log", ["desk", "log"] as const);
  const [q, setQ] = React.useState("");
  // results remember the query they answer, so a slow reply can never show (or check in) the wrong person
  const [hitsFor, setHitsFor] = React.useState<{ term: string; rows: DeskMember[] }>({ term: "", rows: [] });
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const [sel, setSel] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [today, setToday] = React.useState(initial);
  const [count, setCount] = React.useState(total);
  const [day, setDay] = React.useState(todayKey);
  const [other, setOther] = React.useState<{ key: string; items: TodayItem[]; total: number } | null>(null);
  const [loadingDay, startDay] = React.useTransition();
  const [hourFilter, setHourFilter] = React.useState<number | null>(null);
  const [methodFilter, setMethodFilter] = React.useState<MethodKey | "all">("all");
  const [scanOpen, setScanOpen] = React.useState(false);
  const [range, setRange] = useHourRange();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  const viewingToday = day === todayKey;
  const items = React.useMemo(() => (viewingToday ? today : (other?.items ?? [])), [viewingToday, today, other]);
  const shownTotal = viewingToday ? count : (other?.total ?? 0);

  useLiveEvents(["checkins"], (e) => {
    if (e.action !== "create") return;
    const r = e.row as { $id: string; memberId: string; memberName: string; at: string; method: string; by?: string | null };
    setToday((xs) => {
      if (xs.some((x) => x.id === r.$id)) return xs;
      setCount((c) => c + 1);
      return [{ id: r.$id, memberId: r.memberId, name: r.memberName, at: r.at, method: r.method, by: r.by ?? null }, ...xs];
    });
  });

  // No live connection? Refresh today's list every 30 s so the desk never goes stale.
  usePollWhenNotLive(async () => {
    const r = await deskDayAction(todayKey).catch(() => null);
    if (!r) return;
    setToday(r.items);
    setCount(r.total);
  });

  const pickDay = (key: string) => {
    setDay(key);
    setHourFilter(null);
    if (key === todayKey) return;
    startDay(async () => {
      const r = await deskDayAction(key);
      setOther({ key, ...r });
    });
  };

  // debounced search; superseded requests are cancelled
  React.useEffect(() => {
    const term = q.trim();
    if (!term || (term.length < 2 && !/^\d$/.test(term))) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/desk/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" });
        if (res.status === 401) return router.push("/login?next=/front-desk");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { q: string; hits: DeskMember[] };
        setHitsFor({ term: data.q.trim(), rows: data.hits });
        setSearchError(false);
        setSel(0);
        setSearching(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSearchError(true);
        setSearching(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, router]);

  const term = q.trim();
  const fresh = hitsFor.term === term;
  const hits = hitsFor.rows;

  /** Check-in outcome as a corner toast: green welcome, amber reminder, red "can't enter" with next steps. */
  const showResult = (r: Result) => {
    const red = r.blocked || r.status === "expired" || r.status === "none" || r.status === "cancelled" || r.status === "frozen" || r.status === "upcoming";
    const amber = !red && (r.status === "expiring" || r.balanceDue > 0);
    const first = r.name.split(" ")[0];
    const d = daysUntil(r.expiresAt);
    const title = r.blocked ? `${r.name} can’t enter yet` : r.duplicate ? `${r.name} is already in` : `Welcome, ${first}!`;
    const why = red
      ? r.status === "upcoming"
        ? "Their new plan hasn’t started yet."
        : r.status === "frozen"
          ? "Membership is on hold — resume it first."
          : r.status === "none"
            ? "No active membership — sell a plan."
            : `Membership expired${r.expiresAt ? ` ${fmtDate(r.expiresAt)}` : ""} — please renew.`
      : r.status === "expiring"
        ? `Plan ends ${d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`} — remind them to renew.`
        : `Visit #${r.visitCount}${r.expiresAt ? ` · valid till ${fmtDate(r.expiresAt)}` : ""}`;
    const actions = [
      ...(r.blocked ? [{ label: "Let in once", onClick: () => void doCheckIn({ id: r.memberId, name: r.name }, "manual", true) }] : []),
      ...(red || r.balanceDue > 0
        ? [
            {
              label: r.balanceDue > 0 && !red ? `Collect ${inr(r.balanceDue)}` : "Renew plan",
              primary: true,
              onClick: () => router.push(`/members/${r.memberId}?action=${r.balanceDue > 0 && !red ? "collect" : "renew"}`),
            },
          ]
        : []),
    ];
    notify.person(red ? "error" : amber ? "warning" : "success", r.name, title, {
      description: (
        <>
          {why}
          {r.balanceDue > 0 && <span className="block font-medium text-danger-ink">{inr(r.balanceDue)} due</span>}
        </>
      ),
      actions,
      duration: r.blocked ? 12000 : actions.length ? 7000 : 4000,
      id: `checkin-${r.memberId}`,
    });
  };

  const doCheckIn = async (m: { id: string; name: string }, method: "manual" | "qr" = "manual", override = false) => {
    setBusy(m.id);
    try {
      const r = await checkInAction(m.id, method, override);
      if (!r.ok) return void notify.error(r.error);
      showResult({ ...r.data!, name: m.name, memberId: m.id });
      setQ("");
      setHitsFor({ term: "", rows: [] });
      inputRef.current?.focus();
    } catch {
      notify.error("Couldn’t check in — check the internet connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const term = q.trim();
      // exact code (USB/QR scanner types it then Enter) → check in without waiting for the list
      if (/^M\d{3,}$/i.test(term)) {
        const code = term.toUpperCase();
        const r = hits.find((h) => h.code?.toUpperCase() === code) ?? (await deskSearchAction(term)).find((h) => h.code?.toUpperCase() === code);
        if (r) return doCheckIn(r, "qr");
        return void notify.error(`No member with code ${code}`);
      }
      if (!fresh) return; // results for this exact text haven't arrived yet
      if (hits[sel]) doCheckIn(hits[sel]);
    } else if (e.key === "Escape") {
      setQ("");
      setHitsFor({ term: "", rows: [] });
    }
  };

  // global shortcut: "/" focuses search
  React.useEffect(() => {
    const onDoc = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onDoc);
    return () => window.removeEventListener("keydown", onDoc);
  }, []);

  const active = term.length >= 2 || /^\d$/.test(term);
  const visibleHits = active ? hits : [];
  const lastToday = React.useMemo(() => {
    const m = new Map<string, TodayItem>();
    for (const t of today) if (!m.has(t.memberId)) m.set(t.memberId, t);
    return m;
  }, [today]);

  const hours = React.useMemo(() => {
    const buckets = Array.from({ length: range.to - range.from }, (_, i) => ({ hour: range.from + i, total: 0, by: {} as Partial<Record<MethodKey, number>> }));
    for (const t of items) {
      const b = buckets[istHour(t.at) - range.from];
      if (!b) continue;
      b.total++;
      const k = methodKey(t.method);
      b.by[k] = (b.by[k] ?? 0) + 1;
    }
    return buckets;
  }, [items, range]);
  const maxH = Math.max(1, ...hours.map((h) => h.total));
  const methodsPresent = React.useMemo(() => {
    const m = new Map<MethodKey, number>();
    for (const t of items) m.set(methodKey(t.method), (m.get(methodKey(t.method)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const listed = items.filter((t) => (hourFilter === null || istHour(t.at) === hourFilter) && (methodFilter === "all" || methodKey(t.method) === methodFilter));

  return (
    <>
      <PageHeader
        title="Front desk"
        description={`Find a member at ${gymName} and check them in. Fingerprint, Face ID and QR check-ins appear here on their own.`}
        actions={
          <div data-tour="desk-actions" className="flex flex-wrap items-center gap-2">
            <LiveDot />
            <Button variant="outline" asChild>
              <Link href="/kiosk">
                <AnimatedIcon icon={ScanFace} /> Face kiosk
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setScanOpen(true)}>
              <AnimatedIcon icon={QrCode} /> Scan QR
            </Button>
          </div>
        }
      />

      <TabsBar
        value={tab}
        onChange={setTab}
        className="mb-4"
        layoutId="desk-tabs"
        tabs={[
          { value: "desk", label: "Check in", icon: ScanLine },
          { value: "log", label: "Attendance log", icon: CalendarDays },
        ]}
      />

      {tab === "log" ? (
        <AttendanceLog todayKey={todayKey} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div data-tour="desk-search" className="surface relative p-4 sm:p-5">
              <label className="anim-host flex h-16 items-center gap-3 rounded-2xl border-2 bg-card px-4 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-8 focus-within:ring-primary/10">
                {searching ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <AnimatedIcon icon={Search} className="size-6 text-muted-foreground" />
                )}
                <input
                  ref={inputRef}
                  autoFocus
                  value={q}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQ(v);
                    const t = v.trim();
                    setSearching(t.length >= 2 || /^\d$/.test(t));
                  }}
                  onKeyDown={onKey}
                  placeholder="Name, phone or member number"
                  className="h-full min-w-0 flex-1 bg-transparent text-xl font-medium outline-none placeholder:text-subtle"
                  aria-label="Find member"
                  autoComplete="off"
                  spellCheck={false}
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQ("");
                      setHitsFor({ term: "", rows: [] });
                      inputRef.current?.focus();
                    }}
                    className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <kbd className="hidden rounded-lg border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:block">/</kbd>
              </label>

              <ul className="mt-3 flex flex-col gap-2" role="listbox" aria-label="Search results">
                <AnimatePresence initial={false}>
                  {visibleHits.map((m, i) => {
                    const meta = STATUS_META[m.status];
                    const d = daysUntil(m.expiresAt);
                    const inToday = lastToday.get(m.id);
                    return (
                      <motion.li
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        role="option"
                        aria-selected={i === sel}
                        onMouseEnter={() => setSel(i)}
                        aria-disabled={!fresh}
                        className={cn(
                          "flex items-center gap-4 rounded-2xl border p-3 transition-[background-color,border-color,opacity]",
                          i === sel && fresh ? "border-primary/50 bg-primary/5" : "bg-card",
                          !fresh && "opacity-45",
                        )}
                      >
                        <PersonAvatar name={m.name} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{m.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {m.code} · {fmtPhone(m.phone)} · {m.planName ?? "No plan"}
                          </p>
                          {inToday && (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              Already in today at {fmtTime(inToday.at)} <MethodBadge method={inToday.method} />
                            </p>
                          )}
                        </div>
                        <div className="hidden text-right sm:block">
                          <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {d == null ? "No plan" : d < 0 ? `expired ${fmtDate(m.expiresAt)}` : `until ${fmtDate(m.expiresAt)}`}
                          </p>
                        </div>
                        {m.balanceDue > 0 && (
                          <Tag tone="red" className="hidden md:inline-flex">
                            {inr(m.balanceDue)} due
                          </Tag>
                        )}
                        <Button size="lg" loading={busy === m.id} disabled={!fresh} onClick={() => doCheckIn(m)} className="shrink-0">
                          <AnimatedIcon icon={ScanLine} /> Check in
                        </Button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
                {active && !searching && searchError && (
                  <li className="py-8 text-center text-sm text-destructive">Search isn’t responding. Check the internet connection and try again.</li>
                )}
                {active && fresh && !searchError && visibleHits.length === 0 && (
                  <li className="py-8 text-center text-sm text-muted-foreground">
                    No member matches “{term}”. Try part of the name, the last digits of their phone, or their member number.
                  </li>
                )}
                {!active && (
                  <li className="grid gap-2 py-5 text-sm text-muted-foreground sm:grid-cols-3">
                    <span className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
                      <Search className="mt-0.5 size-4 shrink-0" /> Type part of a name, phone number or member number (140).
                    </span>
                    <span className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
                      <Keyboard className="mt-0.5 size-4 shrink-0" /> ↑ ↓ to pick a person, Enter to check them in.
                    </span>
                    <span className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
                      <QrCode className="mt-0.5 size-4 shrink-0" /> A USB barcode or QR scanner types the code for you.
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <HourChart
              hours={hours}
              maxH={maxH}
              range={range}
              onRange={setRange}
              day={day}
              todayKey={todayKey}
              onDay={pickDay}
              loading={loadingDay}
              hourFilter={hourFilter}
              onHour={(h) => setHourFilter((x) => (x === h ? null : h))}
              methods={methodsPresent.map(([k]) => k)}
            />
          </div>

          <div data-tour="desk-list" className="surface flex max-h-[calc(100dvh-160px)] min-h-[420px] flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted-foreground">
                  Checked in · {dayTitle(day, todayKey)}
                  <button type="button" onClick={() => setTab("log")} className="ml-2 font-medium text-primary hover:underline">
                    Full log
                  </button>
                </p>
                <motion.p
                  key={`${day}-${shownTotal}`}
                  initial={{ scale: 1.12 }}
                  animate={{ scale: 1 }}
                  className="tabular text-3xl font-semibold tracking-tight"
                >
                  {shownTotal}
                </motion.p>
              </div>
              {hourFilter !== null && (
                <button
                  type="button"
                  onClick={() => setHourFilter(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {hourLabel(hourFilter)} – {hourLabel(hourFilter + 1)} <X className="size-3" />
                </button>
              )}
            </div>

            {methodsPresent.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by how they checked in">
                {[["all", items.length] as const, ...methodsPresent].map(([k, n]) => {
                  const on = methodFilter === k;
                  const M = k === "all" ? null : METHODS[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMethodFilter(k)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {M && <M.icon className="size-3.5" />}
                      {M ? M.label : "All"}
                      <span className={cn("tabular", on ? "opacity-80" : "text-muted-foreground")}>{n}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <ul className="-mx-2 mt-3 flex-1 scrollbar-thin overflow-y-auto">
              <AnimatePresence initial={false}>
                {listed.map((t) => (
                  <CheckinRow key={t.id} item={t} />
                ))}
              </AnimatePresence>
              {listed.length === 0 && (
                <li className="py-10 text-center text-sm text-muted-foreground">
                  {loadingDay
                    ? "Loading…"
                    : items.length === 0
                      ? viewingToday
                        ? "No one yet — the first check-in of the day will pop in here."
                        : "No check-ins on this day."
                      : "No check-ins match this filter."}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <QrScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={async (code) => {
          setScanOpen(false);
          const r = (await deskSearchAction(code)).find((h) => h.code?.toUpperCase() === code.toUpperCase());
          if (r) doCheckIn(r, "qr");
          else notify.error(`No member with code ${code}`);
        }}
      />
    </>
  );
}

/* ─────────────────────────── check-in row + details ─────────────────────────── */

type Detail = Awaited<ReturnType<typeof checkinDetailAction>>;

function CheckinRow({ item }: { item: TodayItem }) {
  const [detail, setDetail] = React.useState<Detail | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const m = methodOf(item.method);
  const change = (v: boolean) => {
    setOpen(v);
    if (!v || detail !== undefined) return;
    checkinDetailAction(item.id)
      .then(setDetail)
      .catch(() => setDetail(null));
  };
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -10, backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl"
    >
      <Popover open={open} onOpenChange={change}>
        <PopoverAnchor asChild>
          <div className={cn("flex items-center gap-1 rounded-xl pr-1 hover:bg-muted/60", open && "bg-muted/60")}>
            <button
              type="button"
              onClick={() => change(!open)}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
            >
              <PersonAvatar name={item.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", m.text)}>
                  <m.icon className="size-3.5" /> {m.label}
                </span>
              </span>
              <span className="tabular text-xs text-muted-foreground">{fmtTime(item.at)}</span>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => change(!open)}
                  aria-label={`How ${item.name} checked in`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <Info className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {howText(item)} · {fmtTime(item.at)}
              </TooltipContent>
            </Tooltip>
          </div>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center gap-3 border-b p-4">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-muted", m.text)}>
              <m.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {howText(item)}, {fmtTime(item.at)}
              </p>
            </div>
          </div>
          <div className="p-4 text-sm">
            {detail === undefined ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </p>
            ) : detail?.member ? (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Plan</dt>
                    <dd className="mt-0.5 font-medium">{detail.member.planName ?? "No plan"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="mt-0.5">
                      <StatusDot tone={STATUS_META[detail.member.status].tone}>{STATUS_META[detail.member.status].label}</StatusDot>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valid till</dt>
                    <dd className="mt-0.5">{detail.member.expiresAt ? fmtDate(detail.member.expiresAt) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Balance</dt>
                    <dd className={cn("mt-0.5", detail.member.balanceDue > 0 && "font-medium text-destructive")}>
                      {detail.member.balanceDue > 0 ? inr(detail.member.balanceDue) : "Nothing due"}
                    </dd>
                  </div>
                </dl>
                {detail.recent.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground">Earlier visits</p>
                    <ul className="mt-1.5 grid gap-1">
                      {detail.recent.slice(0, 4).map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="tabular text-muted-foreground">{fmtDate(r.at, "dd MMM yyyy, h:mm a")}</span>
                          <MethodBadge method={r.method} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                  <Link href={`/members/${detail.member.id}`}>Open {detail.member.name.split(" ")[0]}’s profile</Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">This member was removed.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </motion.li>
  );
}

/* ─────────────────────────── check-ins by hour ─────────────────────────── */

function HourChart({
  hours,
  maxH,
  range,
  onRange,
  day,
  todayKey,
  onDay,
  loading,
  hourFilter,
  onHour,
  methods,
}: {
  hours: { hour: number; total: number; by: Partial<Record<MethodKey, number>> }[];
  maxH: number;
  range: { from: number; to: number };
  onRange: (v: { from: number; to: number }) => void;
  day: string;
  todayKey: string;
  onDay: (key: string) => void;
  loading: boolean;
  hourFilter: number | null;
  onHour: (h: number) => void;
  methods: MethodKey[];
}) {
  const yesterday = addDays(todayKey, -1);
  const busiest = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0] ?? { hour: 0, total: 0 });
  const order: MethodKey[] = ["manual", "qr", "face", "fingerprint", "card", "kiosk", "biometric"];
  return (
    <div data-tour="desk-hours" className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold">Check-ins by hour</p>
          <p className="text-xs text-muted-foreground">
            {busiest?.total
              ? `Busiest: ${hourLabel(busiest.hour)} – ${hourLabel(busiest.hour + 1)} (${busiest.total})`
              : "Tap a bar to see who came in that hour."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[10px] bg-muted p-0.5 text-xs font-medium" role="radiogroup" aria-label="Day">
            {[
              [todayKey, "Today"],
              [yesterday, "Yesterday"],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={day === k}
                onClick={() => onDay(k)}
                className={cn(
                  "h-7 rounded-lg px-2.5 transition-colors",
                  day === k ? "bg-card shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
            <label
              className={cn(
                "relative h-7 rounded-lg px-2.5 leading-7",
                day !== todayKey && day !== yesterday ? "bg-card shadow-[var(--shadow-card)]" : "text-muted-foreground",
              )}
            >
              {day !== todayKey && day !== yesterday ? fmtDate(`${day}T12:00:00+05:30`, "dd MMM") : "Pick date"}
              <input
                type="date"
                aria-label="Pick a date"
                max={todayKey}
                value={day}
                onChange={(e) => e.target.value && onDay(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {hourLabel(range.from)} – {hourLabel(range.to)}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="text-sm font-medium">Hours to show</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onRange({ from: p.from, to: p.to })}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-left text-xs",
                      range.from === p.from && range.to === p.to ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
                    )}
                  >
                    {p.label}
                    <span className="block text-muted-foreground">
                      {hourLabel(p.from)} – {hourLabel(p.to)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <label className="grid gap-1">
                  From
                  <select
                    value={range.from}
                    onChange={(e) => onRange({ from: Number(e.target.value), to: Math.max(range.to, Number(e.target.value) + 1) })}
                    className="h-9 rounded-lg border bg-card px-2 text-sm"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  To
                  <select
                    value={range.to}
                    onChange={(e) => onRange({ from: range.from, to: Number(e.target.value) })}
                    className="h-9 rounded-lg border bg-card px-2 text-sm"
                  >
                    {Array.from({ length: 24 - range.from }, (_, i) => range.from + 1 + i).map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Saved on this computer.</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className={cn("mt-4 flex h-36 items-end gap-1", loading && "opacity-50")}>
        {hours.map((h) => (
          <Tooltip key={h.hour}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => h.total && onHour(h.hour)}
                aria-label={`${hourLabel(h.hour)}: ${h.total} check-ins`}
                className={cn("group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1", !h.total && "cursor-default")}
              >
                <span className={cn("tabular text-[10px] font-medium text-muted-foreground", !h.total && "invisible")}>{h.total}</span>
                <motion.span
                  initial={false}
                  animate={{ height: `${Math.max(3, (h.total / maxH) * 100)}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                  className={cn(
                    "flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-md transition-opacity",
                    !h.total && "bg-track",
                    hourFilter !== null && hourFilter !== h.hour && "opacity-35",
                    hourFilter === h.hour && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                >
                  {order.map((k) => (h.by[k] ? <span key={k} className={METHODS[k].bar} style={{ flexGrow: h.by[k] }} /> : null))}
                </motion.span>
                <span className="tabular text-[10px] text-subtle">{shortHour(h.hour)}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">
                {hourLabel(h.hour)} – {hourLabel(h.hour + 1)}: {h.total} check-in{h.total === 1 ? "" : "s"}
              </p>
              {order
                .filter((k) => h.by[k])
                .map((k) => (
                  <p key={k} className="text-xs opacity-80">
                    {METHODS[k].label}: {h.by[k]}
                  </p>
                ))}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {methods.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {order
            .filter((k) => methods.includes(k))
            .map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", METHODS[k].bar)} />
                {METHODS[k].label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function QrScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const W = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector };
    (async () => {
      if (!W.BarcodeDetector) {
        setError("This browser can't scan QR codes. Use Chrome on Android, or a USB scanner in the search box.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const det = new W.BarcodeDetector({ formats: ["qr_code", "code_128"] });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await det.detect(videoRef.current);
            const hit = codes.map((c) => c.rawValue.trim()).find((v) => /^M\d{3,}$/i.test(v) || /^gymos:/i.test(v));
            if (hit) return onCode(hit.replace(/^gymos:(member:)?/i, "").toUpperCase());
          } catch {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError("Camera permission was denied.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      setError(null);
    };
  }, [open, onCode]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div className="p-5 pb-0">
          <DialogTitle>Scan member QR</DialogTitle>
          <DialogDescription>Point the camera at the QR on the member&apos;s card or phone.</DialogDescription>
        </div>
        <div className="relative m-5 aspect-square overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
          <motion.div
            className="pointer-events-none absolute inset-x-10 h-0.5 bg-lime shadow-[0_0_12px_var(--lime)]"
            animate={{ top: ["18%", "82%", "18%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
