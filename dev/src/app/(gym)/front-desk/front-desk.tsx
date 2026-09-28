"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, CircleX, Keyboard, Loader2, QrCode, ScanLine, Search, Wallet, X } from "@/components/icons";
import { PageHeader } from "@/components/kit/page-header";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { StatusDot, Tag } from "@/components/kit/badges";
import { LiveDot, useLiveEvents } from "@/components/realtime/realtime-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { STATUS_META } from "@/lib/domain/membership";
import { daysUntil, fmtDate, fmtPhone, fmtTime, inr } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { checkInAction, deskSearchAction, type DeskMember } from "../_actions/frontdesk";

type TodayItem = { id: string; memberId: string; name: string; at: string; method: string };
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

export function FrontDesk({ gymName, today: initial, total }: { gymName: string; today: TodayItem[]; total: number }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<DeskMember[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [sel, setSel] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [today, setToday] = React.useState(initial);
  const [count, setCount] = React.useState(total);
  const [scanOpen, setScanOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useLiveEvents(["checkins"], (e) => {
    if (e.action !== "create") return;
    const r = e.row as { $id: string; memberId: string; memberName: string; at: string; method: string };
    setToday((xs) => (xs.some((x) => x.id === r.$id) ? xs : [{ id: r.$id, memberId: r.memberId, name: r.memberName, at: r.at, method: r.method }, ...xs]));
    setCount((c) => c + 1);
  });

  // debounced search
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await deskSearchAction(term);
      if (!alive) return;
      setHits(r);
      setSel(0);
      setSearching(false);
      // barcode/QR scanners type the member code then Enter; an exact code match checks in instantly
    }, 160);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const showResult = (r: Result) => {
    setResult(r);
    emitFeedback(
      r.blocked || r.status === "expired" || r.status === "none" || r.status === "cancelled"
        ? "error"
        : r.status === "expiring" || r.balanceDue > 0
          ? "warning"
          : "success",
    );
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setResult(null), r.blocked ? 12000 : 4500);
  };

  const doCheckIn = async (m: { id: string; name: string }, method: "manual" | "qr" = "manual", override = false) => {
    setBusy(m.id);
    const r = await checkInAction(m.id, method, override);
    setBusy(null);
    if (!r.ok) return void notify.error(r.error);
    showResult({ ...r.data!, name: m.name, memberId: m.id });
    setQ("");
    setHits([]);
    inputRef.current?.focus();
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
      // exact code (scanner) → search immediately if results aren't back yet
      if (/^M\d{3,}$/i.test(term)) {
        const r =
          hits.find((h) => h.code?.toUpperCase() === term.toUpperCase()) ??
          (await deskSearchAction(term)).find((h) => h.code?.toUpperCase() === term.toUpperCase());
        if (r) return doCheckIn(r, "qr");
        return void notify.error(`No member with code ${term.toUpperCase()}`);
      }
      if (hits[sel]) doCheckIn(hits[sel]);
    } else if (e.key === "Escape") {
      setQ("");
      setHits([]);
    }
  };

  // global shortcut: "/" focuses search
  React.useEffect(() => {
    const onDoc = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onDoc);
    return () => window.removeEventListener("keydown", onDoc);
  }, []);

  const visibleHits = q.trim().length >= 2 ? hits : [];
  const hours = React.useMemo(() => {
    const h = Array.from({ length: 18 }, (_, i) => ({ hour: i + 5, n: 0 }));
    for (const t of today) {
      const hr = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date(t.at)));
      const slot = h.find((x) => x.hour === hr);
      if (slot) slot.n++;
    }
    return h;
  }, [today]);
  const maxH = Math.max(1, ...hours.map((h) => h.n));

  return (
    <>
      <PageHeader
        title="Front desk"
        description={`Check members in at ${gymName}. Type a name, phone or member code — or scan their QR.`}
        actions={
          <>
            <LiveDot />
            <Button variant="outline" onClick={() => setScanOpen(true)}>
              <AnimatedIcon icon={QrCode} /> Scan QR
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <div className="surface relative p-4 sm:p-5">
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
                  setQ(e.target.value);
                  setSearching(e.target.value.trim().length >= 2);
                }}
                onKeyDown={onKey}
                placeholder="Search name, phone or scan member code…"
                className="h-full min-w-0 flex-1 bg-transparent text-xl font-medium outline-none placeholder:text-subtle"
                aria-label="Find member"
                autoComplete="off"
                spellCheck={false}
              />
              {q && (
                <button
                  type="button"
                  aria-label="Clear"
                  onClick={() => setQ("")}
                  className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              )}
              <kbd className="hidden rounded-lg border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:block">/</kbd>
            </label>

            <ul className="mt-3 flex flex-col gap-2" role="listbox" aria-label="Results">
              <AnimatePresence initial={false}>
                {visibleHits.map((m, i) => {
                  const meta = STATUS_META[m.status];
                  const d = daysUntil(m.expiresAt);
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
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border p-3 transition-colors",
                        i === sel ? "border-primary/50 bg-success-soft/30" : "bg-card",
                      )}
                    >
                      <PersonAvatar name={m.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{m.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {m.code} · {fmtPhone(m.phone)} · {m.planName ?? "No plan"}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {d == null ? "—" : d < 0 ? `expired ${fmtDate(m.expiresAt)}` : `until ${fmtDate(m.expiresAt)}`}
                        </p>
                      </div>
                      {m.balanceDue > 0 && (
                        <Tag tone="red" className="hidden md:inline-flex">
                          {inr(m.balanceDue)} due
                        </Tag>
                      )}
                      <Button size="lg" loading={busy === m.id} onClick={() => doCheckIn(m)} className="shrink-0">
                        <AnimatedIcon icon={ScanLine} /> Check in
                      </Button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {q.trim().length >= 2 && !searching && visibleHits.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">No member matches “{q}”.</li>
              )}
              {q.trim().length < 2 && (
                <li className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Keyboard className="size-4" /> Use ↑ ↓ to choose and Enter to check in. Barcode scanners work too.
                </li>
              )}
            </ul>
          </div>

          <div className="surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold">Today by hour</p>
              <p className="text-xs text-muted-foreground">5 AM – 10 PM</p>
            </div>
            <div className="flex h-28 items-end gap-1.5">
              {hours.map((h) => (
                <div key={h.hour} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(h.n / maxH) * 100}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 20 }}
                    className={cn("min-h-[3px] w-full rounded-md", h.n ? "bg-lime" : "bg-track")}
                    title={`${h.n} check-ins`}
                  />
                  <span className="tabular text-[10px] text-subtle">{h.hour % 12 || 12}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="surface flex max-h-[calc(100dvh-160px)] flex-col p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-muted-foreground">Checked in today</p>
              <motion.p key={count} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="tabular text-3xl font-semibold tracking-tight">
                {count}
              </motion.p>
            </div>
            <LiveDot />
          </div>
          <ul className="-mx-2 mt-3 flex-1 scrollbar-thin overflow-y-auto">
            <AnimatePresence initial={false}>
              {today.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -10, backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
                  animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.6 }}
                  className="rounded-xl"
                >
                  <Link href={`/members/${t.memberId}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                    <PersonAvatar name={t.name} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                    {t.method === "qr" && <QrCode className="size-3.5 text-subtle" />}
                    <span className="tabular text-xs text-muted-foreground">{fmtTime(t.at)}</span>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
            {today.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">No one yet — the first check-in of the day will pop in here.</li>
            )}
          </ul>
        </div>
      </div>

      <ResultOverlay result={result} onClose={() => setResult(null)} onOverride={(r) => doCheckIn({ id: r.memberId, name: r.name }, "manual", true)} />
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

function ResultOverlay({ result, onClose, onOverride }: { result: Result | null; onClose: () => void; onOverride: (r: Result) => void }) {
  const tone = !result
    ? "green"
    : result.blocked || result.status === "expired" || result.status === "none" || result.status === "cancelled"
      ? "red"
      : result.status === "expiring" || result.balanceDue > 0
        ? "amber"
        : "green";
  const Icon = tone === "red" ? CircleX : tone === "amber" ? CircleAlert : CircleCheck;
  const d = result ? daysUntil(result.expiresAt) : null;
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-lg"
          role="status"
        >
          <div
            className={cn(
              "flex items-center gap-4 rounded-3xl border p-5 shadow-[var(--shadow-pop)] backdrop-blur-xl",
              tone === "green" && "border-success/30 bg-success-soft/90",
              tone === "amber" && "border-warning/40 bg-warning-soft/95",
              tone === "red" && "border-destructive/30 bg-danger-soft/95",
            )}
          >
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.05 }}
            >
              <Icon
                className={cn("size-12", tone === "green" && "text-success", tone === "amber" && "text-warning-ink", tone === "red" && "text-destructive")}
              />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">
                {result.blocked
                  ? `${result.name} can't enter yet`
                  : result.duplicate
                    ? `${result.name} is already in`
                    : `Welcome, ${result.name.split(" ")[0]}!`}
              </p>
              <p className="text-sm">
                {tone === "red"
                  ? result.status === "upcoming"
                    ? "Their new plan hasn't started yet."
                    : result.status === "frozen"
                      ? "Membership is frozen — resume it first."
                      : result.status === "none"
                        ? "No active membership — sell a plan."
                        : `Membership expired ${result.expiresAt ? fmtDate(result.expiresAt) : ""} — please renew.`
                  : result.status === "expiring"
                    ? `Expires ${d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`} — remind them to renew.`
                    : `Visit #${result.visitCount}${result.expiresAt ? ` · valid till ${fmtDate(result.expiresAt)}` : ""}`}
              </p>
              {result.balanceDue > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-danger-ink">
                  <Wallet className="size-3.5" /> {inr(result.balanceDue)} due
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {(tone !== "green" || result.balanceDue > 0) && (
                <Button size="sm" asChild>
                  <Link href={`/members/${result.memberId}?action=${result.balanceDue > 0 && tone !== "red" ? "collect" : "renew"}`}>
                    {result.balanceDue > 0 && tone !== "red" ? "Collect" : "Renew"}
                  </Link>
                </Button>
              )}
              {result.blocked ? (
                <Button size="sm" variant="ghost" onClick={() => onOverride(result)}>
                  Let in once
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
