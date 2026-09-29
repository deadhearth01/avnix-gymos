"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { DriveStep, Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { BookOpen, Check, CircleCheck, Play, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

/* ─────────────────────────── the guide, chapter by chapter ─────────────────────────── */

type Step = { el?: string; title: string; body: string; side?: "left" | "right" | "top" | "bottom" };
type Chapter = { id: string; path: string; title: string; summary: string; steps: Step[] };

const nav = (href: string) => `[data-tour="nav${href.replace(/\//g, "-")}"]`;

export const CHAPTERS: Chapter[] = [
  {
    id: "basics",
    path: "/dashboard",
    title: "Getting around",
    summary: "The menu, today’s numbers and quick search.",
    steps: [
      {
        el: '[data-tour="nav-dashboard"]',
        title: "The menu",
        body: "Every part of GymOS is here on the left. We’ll visit the ones you’ll use most.",
        side: "right",
      },
      {
        el: '[data-tour="kpis"]',
        title: "Today at a glance",
        body: "Active members, money collected this month, money still due, and plans ending this week.",
        side: "bottom",
      },
      {
        el: '[data-tour="revenue"]',
        title: "Collections",
        body: "What you collected in each of the last 12 months. Point at a bar to see the exact amount.",
        side: "top",
      },
      { el: '[data-tour="search"]', title: "Find anything", body: "Search any member, lead or page. Shortcut: Ctrl + K (⌘ + K on a Mac).", side: "right" },
      { el: '[data-tour="page-actions"]', title: "Quick buttons", body: "Check someone in or add a new member straight from here.", side: "bottom" },
    ],
  },
  {
    id: "desk",
    path: "/front-desk",
    title: "Front desk & check-ins",
    summary: "Check members in and see who came, when and how.",
    steps: [
      {
        el: '[data-tour="desk-search"]',
        title: "Check someone in",
        body: "Type part of a name, the last digits of their phone, or their member number — then press Enter or tap Check in.",
        side: "bottom",
      },
      {
        el: '[data-tour="desk-actions"]',
        title: "Live, QR and Face ID",
        body: "“Live” means new check-ins appear by themselves. Scan QR uses the camera. Face kiosk turns a tablet into a Face ID check-in screen.",
        side: "bottom",
      },
      {
        el: '[data-tour="desk-list"]',
        title: "Who came in",
        body: "Everyone checked in today, and how — desk, QR, fingerprint or Face ID. Tap a name to see details.",
        side: "left",
      },
      {
        el: '[data-tour="desk-hours"]',
        title: "Busy hours",
        body: "Check-ins by hour. Switch to yesterday or any date, and choose which hours to show.",
        side: "top",
      },
      {
        el: '[data-tour="tabs"]',
        title: "Attendance log",
        body: "Every check-in for any day or range of dates — who, what time and how. You can download it for Excel.",
        side: "bottom",
      },
    ],
  },
  {
    id: "members",
    path: "/members",
    title: "Members",
    summary: "Add members, find them and open their profile.",
    steps: [
      {
        el: '[data-tour="add-member"]',
        title: "Add a member",
        body: "Name, phone number and a plan is all you need. You can fill in the rest later.",
        side: "bottom",
      },
      {
        el: "main table",
        title: "Your members",
        body: "Search, filter by status (active, ending soon, expired) and tap anyone to open their profile, member card and Face ID.",
        side: "top",
      },
    ],
  },
  {
    id: "billing",
    path: "/billing",
    title: "Billing & payments",
    summary: "Collect payments; GST invoices are made for you.",
    steps: [
      { el: '[data-tour="collect"]', title: "Collect a payment", body: "Cash, UPI or card. The member gets a receipt on WhatsApp.", side: "bottom" },
      {
        el: '[data-tour="tabs"]',
        title: "Invoices, payments and dues",
        body: "Every GST invoice is numbered automatically. “Dues” shows who still owes money.",
        side: "bottom",
      },
    ],
  },
  {
    id: "plans",
    path: "/plans",
    title: "Plans & prices",
    summary: "Membership and personal-training prices.",
    steps: [
      {
        el: '[data-tour="page-actions"]',
        title: "Create a plan",
        body: "Monthly, quarterly, yearly or a pack of personal-training sessions — with your price.",
        side: "bottom",
      },
      { el: "main", title: "Change prices any time", body: "New prices apply to new sales. Members keep what they already paid for.", side: "top" },
    ],
  },
  {
    id: "leads",
    path: "/leads",
    title: "Leads & trials",
    summary: "Enquiries and free-trial bookings.",
    steps: [
      {
        el: '[data-tour="add-lead"]',
        title: "Add an enquiry",
        body: "Walk-ins and phone calls go here. Trial bookings from your website arrive on their own.",
        side: "bottom",
      },
      {
        el: '[data-tour="lead-board"]',
        title: "Move people along",
        body: "Drag a card from “New” to “Trial booked” to “Joined”. Joined leads become members in one tap.",
        side: "top",
      },
    ],
  },
  {
    id: "automations",
    path: "/automations",
    title: "WhatsApp reminders",
    summary: "Renewal, birthday and payment messages.",
    steps: [
      {
        el: '[data-tour="tabs"]',
        title: "Messages that send themselves",
        body: "Renewal reminders, birthday wishes and receipts, in English or Telugu. Messages waiting for you are in the Outbox.",
        side: "bottom",
      },
    ],
  },
  {
    id: "website",
    path: "/website",
    title: "Your website",
    summary: "Headline, photos, prices and trial booking.",
    steps: [
      {
        el: "main section",
        title: "Edit your website",
        body: "Change the headline, photos, coaches and prices. Nothing changes online until you press Publish.",
        side: "top",
      },
      { el: "main aside", title: "Preview and share", body: "Open your live website or copy its link to share on WhatsApp and Instagram.", side: "left" },
    ],
  },
  {
    id: "devices",
    path: "/devices",
    title: "Fingerprint & Face ID",
    summary: "Connect your attendance machine or a camera.",
    steps: [
      {
        el: '[data-tour="page-actions"]',
        title: "Connect a machine",
        body: "Add your fingerprint or face machine, or open the Face kiosk on any tablet or laptop with a camera.",
        side: "bottom",
      },
    ],
  },
  {
    id: "settings",
    path: "/settings",
    title: "Your logo & colour",
    summary: "Make GymOS look like your gym.",
    steps: [
      {
        el: '[data-tour="settings-brand"]',
        title: "Logo and colour",
        body: "Upload your logo or pick one of our icons, and choose your colour. The dashboard and website both use them.",
        side: "top",
      },
    ],
  },
];

/* ─────────────────────────── tour state (survives page changes) ─────────────────────────── */

const STATE_KEY = "gymos:guide";
type TourState = { queue: string[]; idx: number; paused?: boolean };
const readState = (): TourState | null => {
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) ?? "null") as TourState | null;
  } catch {
    return null;
  }
};
const writeState = (s: TourState | null) => {
  try {
    if (s) sessionStorage.setItem(STATE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* private mode: the tour simply won't survive a reload */
  }
  window.dispatchEvent(new Event("gymos:guide-state"));
};

/** Chapters this person can see (their menu decides — e.g. trainers don't see Billing). */
function availableChapters() {
  return CHAPTERS.filter((c) => c.path === "/dashboard" || document.querySelector(nav(c.path)));
}

function visible(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

/* ─────────────────────────── controller ─────────────────────────── */

/**
 * Guided onboarding with driver.js: a welcome screen on first login (take the tour or skip),
 * a page-by-page tour with "Skip tour" on every step, and a Guide panel to replay any chapter.
 */
export function OnboardingTour({
  seen,
  enabled,
  firstName,
  markSeen,
}: {
  seen: string[];
  enabled: boolean;
  firstName: string;
  markSeen: (key: string) => Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [done, setDone] = React.useState(() => new Set(seen));
  const [welcome, setWelcome] = React.useState(enabled && !seen.includes("welcome"));
  const [panel, setPanel] = React.useState(false);
  const [paused, setPaused] = React.useState<TourState | null>(null);
  const active = React.useRef<Driver | null>(null);

  const remember = React.useCallback(
    (key: string) => {
      setDone((d) => new Set(d).add(key));
      void markSeen(key).catch(() => {});
    },
    [markSeen],
  );

  const start = React.useCallback(
    (ids: string[]) => {
      active.current?.destroy();
      const queue = ids.filter((id) => CHAPTERS.some((c) => c.id === id));
      if (!queue.length) return;
      const first = CHAPTERS.find((c) => c.id === queue[0])!;
      writeState({ queue, idx: 0 });
      setPaused(null);
      if (first.path === pathname) window.dispatchEvent(new Event("gymos:guide-run"));
      else router.push(first.path);
    },
    [pathname, router],
  );

  // Run the chapter that belongs to this page.
  const run = React.useCallback(async () => {
    const state = readState();
    if (!state || state.paused) return setPaused(state?.paused ? state : null);
    const chapter = CHAPTERS.find((c) => c.id === state.queue[state.idx]);
    if (!chapter) return writeState(null);
    if (chapter.path !== pathname) {
      // they navigated away mid-tour
      writeState({ ...state, paused: true });
      return setPaused({ ...state, paused: true });
    }
    const steps: DriveStep[] = chapter.steps.map((s) => ({
      element: s.el && visible(s.el) ? s.el : undefined,
      popover: { title: s.title, description: s.body, side: s.side, align: "start" },
    }));
    const next = CHAPTERS.find((c) => c.id === state.queue[state.idx + 1]);
    const { driver } = await import("driver.js");
    let finished = false;
    const d = driver({
      steps,
      showProgress: true,
      progressText: `${chapter.title} · {{current}} of {{total}}`,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: next ? `Next: ${next.title}` : "Finish",
      overlayOpacity: 0.5,
      stagePadding: 6,
      stageRadius: 12,
      smoothScroll: true,
      allowClose: true,
      popoverClass: "gymos-tour",
      onPopoverRender: (popover) => {
        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "gymos-tour-skip";
        skip.textContent = "Skip tour";
        skip.onclick = () => {
          writeState(null);
          remember("welcome");
          d.destroy();
        };
        popover.footer.prepend(skip);
      },
      onNextClick: () => {
        if (d.isLastStep()) {
          finished = true;
          d.destroy();
        } else d.moveNext();
      },
      onDestroyed: () => {
        active.current = null;
        if (!finished) {
          // closed with × or Esc: pause, don't lose their place
          const s = readState();
          if (s) {
            writeState({ ...s, paused: true });
            setPaused({ ...s, paused: true });
          }
          return;
        }
        remember(`ch-${chapter.id}`);
        if (next) {
          writeState({ ...state, idx: state.idx + 1 });
          router.push(next.path);
        } else {
          writeState(null);
          remember("welcome");
          notify.success("You’ve finished the guide", { description: "Open Guide in the menu any time to see a part again." });
        }
      },
    });
    active.current = d;
    d.drive();
  }, [pathname, remember, router]);

  React.useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => void run(), 900); // let the page settle
    const onRun = () => void run();
    window.addEventListener("gymos:guide-run", onRun);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("gymos:guide-run", onRun);
    };
  }, [enabled, run]);

  React.useEffect(() => {
    const open = () => setPanel(true);
    window.addEventListener("gymos:tour", open);
    return () => window.removeEventListener("gymos:tour", open);
  }, []);

  React.useEffect(() => () => active.current?.destroy(), []);

  if (!enabled) return null;
  return (
    <>
      <Dialog
        open={welcome}
        onOpenChange={(v) => {
          if (!v) {
            setWelcome(false);
            remember("welcome");
          }
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <div className="grid place-items-center bg-white px-8 pt-6">
            <Image src="/brand/doodles/team.webp" alt="" width={360} height={240} unoptimized className="h-auto w-72 mix-blend-multiply" />
          </div>
          <div className="p-6 pt-4">
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">Welcome to GymOS, {firstName}</DialogTitle>
            <DialogDescription className="mt-1.5 text-[15px]">
              Want a quick tour of the screens you’ll use every day? It takes about 4 minutes and you can stop any time.
            </DialogDescription>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {CHAPTERS.slice(0, 6).map((c) => (
                <li key={c.id} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                  {c.title}
                </li>
              ))}
              <li className="rounded-full px-1 py-1 text-xs text-muted-foreground">and more</li>
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setWelcome(false);
                  remember("welcome");
                  notify.info("No problem", { description: "Open Guide in the menu whenever you’d like the tour." });
                }}
              >
                Skip for now
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  setWelcome(false);
                  remember("welcome");
                  start(availableChapters().map((c) => c.id));
                }}
              >
                <Play /> Start the tour
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={panel} onOpenChange={setPanel}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <div className="border-b p-5">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="size-5 text-primary" /> Guide
            </SheetTitle>
            <SheetDescription>Short walkthroughs of each part of GymOS. Pick one, or take the whole tour.</SheetDescription>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setPanel(false);
                start(availableChapters().map((c) => c.id));
              }}
            >
              <Play /> Take the full tour · about 4 min
            </Button>
          </div>
          <ul className="flex-1 overflow-y-auto p-3">
            {CHAPTERS.map((c) => {
              const ok = done.has(`ch-${c.id}`);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(false);
                      start([c.id]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full",
                        ok ? "bg-success-soft text-success-ink" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {ok ? <CircleCheck className="size-5" /> : <Play className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">{c.summary}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{ok ? "Seen" : "Show me"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      {paused && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover p-1.5 pl-4 text-sm shadow-[var(--shadow-pop,0_18px_40px_-12px_rgb(0_0_0/0.28))]">
          <BookOpen className="size-4 text-primary" />
          <span className="font-medium">Tour paused</span>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              const chapter = CHAPTERS.find((c) => c.id === paused.queue[paused.idx]);
              writeState({ ...paused, paused: false });
              setPaused(null);
              if (chapter && chapter.path !== pathname) router.push(chapter.path);
              else window.dispatchEvent(new Event("gymos:guide-run"));
            }}
          >
            <Check /> Continue
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            aria-label="End the tour"
            onClick={() => {
              writeState(null);
              setPaused(null);
            }}
          >
            <X />
          </Button>
        </div>
      )}
    </>
  );
}

/** Opens the Guide panel (from the menu). */
export function startTour() {
  window.dispatchEvent(new Event("gymos:tour"));
}
