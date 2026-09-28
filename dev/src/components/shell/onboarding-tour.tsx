"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { DriveStep, Driver } from "driver.js";
import "driver.js/dist/driver.css";

type Step = { el?: string; title: string; body: string; side?: "left" | "right" | "top" | "bottom" };

const nav = (href: string) => `[data-tour="nav${href.replace(/\//g, "-")}"]`;

/** First login: a walk down the sidebar. */
const WELCOME: Step[] = [
  { title: "Welcome to GymOS", body: "A quick look around — about a minute. You can replay this any time from your account menu." },
  { el: nav("/dashboard"), title: "Home", body: "Today at a glance: money collected, dues, who checked in and plans about to expire.", side: "right" },
  { el: nav("/front-desk"), title: "Front desk", body: "Check members in by scanning their QR or searching a name or phone number.", side: "right" },
  { el: nav("/members"), title: "Members", body: "Everyone on your books. Sell or renew plans, collect payments, freeze memberships.", side: "right" },
  { el: nav("/leads"), title: "Leads", body: "Trial bookings from your website and walk-in enquiries. Move them along until they join.", side: "right" },
  { el: nav("/billing"), title: "Billing", body: "GST invoices, payments and dues. Everything your accountant asks for.", side: "right" },
  { el: nav("/plans"), title: "Plans", body: "Your membership and personal-training packages, with prices.", side: "right" },
  {
    el: nav("/automations"),
    title: "Automations",
    body: "WhatsApp and SMS reminders that go out on their own — renewals, birthdays, missed visits.",
    side: "right",
  },
  { el: nav("/finance"), title: "Finance", body: "Expenses and profit by month.", side: "right" },
  { el: nav("/website"), title: "Website", body: "Edit your public gym website: photos, coaches, prices and trial booking.", side: "right" },
  { el: '[data-tour="search"]', title: "Quick search", body: "Press ⌘K (Ctrl K on Windows) to find any member, lead or page instantly.", side: "right" },
  {
    el: nav("/settings"),
    title: "Settings",
    body: "Your logo, brand colour, GST details and messaging. Change the colour and the whole app follows.",
    side: "right",
  },
];

/** First visit to a page: what matters on it. */
const PAGES: Record<string, Step[]> = {
  "/dashboard": [
    {
      el: '[data-tour="kpis"]',
      title: "Your numbers",
      body: "Active members, this month’s collections, outstanding dues and plans expiring this week.",
      side: "bottom",
    },
    { el: '[data-tour="revenue"]', title: "Revenue", body: "Collections for the last twelve months. Hover a bar for the exact amount.", side: "top" },
    { el: '[data-tour="page-actions"]', title: "Quick actions", body: "Check someone in or add a new member from anywhere on this page.", side: "bottom" },
  ],
  "/members": [
    {
      el: '[data-tour="page-actions"]',
      title: "Add a member",
      body: "Name, phone and a plan is all you need. The rest can be filled in later.",
      side: "bottom",
    },
    { el: "main table", title: "Your members", body: "Filter by status, search, or click a row to open the member’s profile and card.", side: "top" },
  ],
  "/front-desk": [{ el: "main input", title: "Check-in", body: "Scan a member’s QR code or type their code, name or phone number.", side: "bottom" }],
  "/leads": [
    {
      el: '[data-tour="page-actions"]',
      title: "Add an enquiry",
      body: "Walk-ins and phone calls go here. Website trial bookings arrive on their own.",
      side: "bottom",
    },
  ],
  "/website": [
    {
      el: "main form, main section",
      title: "Edit your site",
      body: "Change the headline, photos, coaches and prices. Nothing goes live until you press Publish.",
      side: "top",
    },
    { el: "aside", title: "Preview and share", body: "Open your live site or copy its link to share on WhatsApp and Instagram.", side: "left" },
  ],
  "/settings": [
    { el: "main", title: "Make it yours", body: "Upload your logo and pick a brand colour — the dashboard and your website both use it.", side: "top" },
  ],
};

function visible(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function toDriveSteps(steps: Step[]): DriveStep[] {
  return steps
    .filter((s) => !s.el || visible(s.el))
    .map((s) => ({ element: s.el, popover: { title: s.title, description: s.body, side: s.side, align: "start" } }));
}

/**
 * Guided tours with driver.js. The welcome tour runs on first login; each page gets a short tour the
 * first time it is opened. Progress is stored on the user (server), so it follows them across devices.
 */
export function OnboardingTour({ seen, enabled, markSeen }: { seen: string[]; enabled: boolean; markSeen: (key: string) => Promise<void> }) {
  const pathname = usePathname();
  const seenRef = React.useRef(new Set(seen));
  const active = React.useRef<Driver | null>(null);

  const run = React.useCallback(
    async (key: string, steps: Step[]) => {
      const drive = toDriveSteps(steps);
      if (!drive.length || active.current) return;
      const { driver } = await import("driver.js");
      const d = driver({
        steps: drive,
        showProgress: drive.length > 1,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        overlayOpacity: 0.45,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: "gymos-tour",
        smoothScroll: true,
        onDestroyed: () => {
          active.current = null;
          seenRef.current.add(key);
          void markSeen(key).catch(() => {});
        },
      });
      active.current = d;
      d.drive();
    },
    [markSeen],
  );

  // Automatic tours: welcome first, then the page's own tour on a later visit.
  React.useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      if (!seenRef.current.has("welcome")) {
        if (window.innerWidth >= 1024) void run("welcome", WELCOME);
        return;
      }
      const key = Object.keys(PAGES).find((p) => pathname === p);
      if (key && !seenRef.current.has(`page${key.replace(/\//g, "-")}`)) void run(`page${key.replace(/\//g, "-")}`, PAGES[key]);
    }, 1400); // after the preloader and page entrance
    return () => window.clearTimeout(timer);
  }, [pathname, enabled, run]);

  // "Take the tour" from the account menu.
  React.useEffect(() => {
    const onReplay = () => {
      const page = PAGES[pathname];
      void run("welcome", page ? [...WELCOME, ...page] : WELCOME);
    };
    window.addEventListener("gymos:tour", onReplay);
    return () => window.removeEventListener("gymos:tour", onReplay);
  }, [pathname, run]);

  React.useEffect(() => () => active.current?.destroy(), []);
  return null;
}

export function startTour() {
  window.dispatchEvent(new Event("gymos:tour"));
}
