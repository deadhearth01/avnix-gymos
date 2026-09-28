"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { WhatsApp, ScanLine } from "@/components/icons";
import { AreaTrend } from "@/components/charts/area-trend";
import { Segmented } from "@/components/kit/segmented";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { LiveDot, useLiveEvents, useLiveRefresh } from "@/components/realtime/realtime-provider";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { fmtTime } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";

type Point = { label: string; value: number; compare?: number };

export function CheckinsTrend({ weekly, monthly, yearly }: { weekly: Point[]; monthly: Point[]; yearly: Point[] }) {
  const [range, setRange] = React.useState<"weekly" | "monthly" | "yearly">("weekly");
  const data = range === "weekly" ? weekly : range === "monthly" ? monthly : yearly;
  const total = data.reduce((s, d) => s + d.value, 0);
  const prev = data.reduce((s, d) => s + (d.compare ?? 0), 0);
  return (
    <div className="surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">Check-ins</p>
          <p className="tabular mt-0.5 flex items-center gap-2 text-[26px] leading-none font-semibold tracking-tight">
            {total.toLocaleString("en-IN")}
            {range !== "yearly" && prev > 0 && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${total >= prev ? "bg-lime-soft text-lime-ink" : "bg-danger-soft text-danger-ink"}`}
              >
                {total >= prev ? "+" : ""}
                {(((total - prev) / prev) * 100).toFixed(1)}%
              </span>
            )}
          </p>
        </div>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
      </div>
      <AreaTrend key={range} data={data} height={210} compareLabel={range === "weekly" ? "Previous week" : "Previous 30 days"} />
    </div>
  );
}

type TodayItem = { id: string; name: string; at: string };

export function TodayFeed({ initial, total, yesterday }: { initial: TodayItem[]; total: number; yesterday: number }) {
  const [items, setItems] = React.useState(initial);
  const [count, setCount] = React.useState(total);
  useLiveEvents(["checkins"], (e) => {
    if (e.action !== "create") return;
    const row = e.row as { $id: string; memberName: string; at: string };
    setItems((xs) => (xs.some((x) => x.id === row.$id) ? xs : [{ id: row.$id, name: row.memberName, at: row.at }, ...xs].slice(0, 40)));
    setCount((c) => c + 1);
    emitFeedback("select");
  });
  return (
    <div className="surface flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">Checked in today</p>
        <LiveDot />
      </div>
      <p className="tabular mt-1 text-[26px] leading-none font-semibold tracking-tight">
        {count}
        <span className="ml-2 text-xs font-normal text-muted-foreground">yesterday {yesterday}</span>
      </p>
      {/* small overlap only: initials sit in the middle and must stay readable */}
      <div className="mt-3 flex -space-x-1">
        {items.slice(0, 7).map((i) => (
          <PersonAvatar key={i.id} name={i.name} size={32} className="ring-2 ring-card" />
        ))}
        {count > 7 && <span className="grid size-8 place-items-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">+{count - 7}</span>}
      </div>
      <ul className="-mx-2 mt-3 max-h-[210px] flex-1 scrollbar-thin overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.li
              key={i.id}
              layout
              initial={{ opacity: 0, y: -8, backgroundColor: "color-mix(in oklab, var(--primary) 12%, transparent)" }}
              animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
            >
              <PersonAvatar name={i.name} size={24} />
              <span className="flex-1 truncate text-sm">{i.name}</span>
              <span className="tabular text-xs text-muted-foreground">{fmtTime(i.at)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No check-ins yet today.</li>}
      </ul>
      <Link
        href="/front-desk"
        className="anim-host mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border bg-card text-sm font-medium shadow-[var(--shadow-card)] hover:bg-muted/70"
      >
        <AnimatedIcon icon={ScanLine} className="size-4" /> Open front desk
      </Link>
    </div>
  );
}

export function WaButton({ phone, text, label = "WhatsApp" }: { phone: string; text: string; label?: string }) {
  const href = waLink(phone, text);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-feedback="success"
      className="anim-host inline-flex h-7 items-center gap-1 rounded-lg bg-success-soft px-2 text-xs font-medium text-success-ink transition-colors hover:bg-success-soft/70"
      aria-label={`${label} ${phone}`}
    >
      <AnimatedIcon icon={WhatsApp} className="size-3.5" /> {label}
    </a>
  );
}

export function DashboardLive() {
  useLiveRefresh(["payments", "members", "leads"], 1500);
  return null;
}
