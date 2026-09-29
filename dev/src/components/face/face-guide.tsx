"use client";

import { Check, X } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { FaceIssue } from "./face-engine";

type Tip = { key: string; img: string; title: string; body: string; good: boolean; issue?: FaceIssue };

/** Illustrated do's and don'ts for a face scan (images in /brand/face-guide). */
export const FACE_TIPS: Tip[] = [
  { key: "center", img: "face-center", title: "Face inside the oval", body: "Look straight at the screen, head and shoulders in view.", good: true },
  { key: "light", img: "face-light", title: "Face the light", body: "Light in front of you — a window or lamp — not behind.", good: true },
  { key: "mask", img: "no-mask", title: "No mask", body: "Lower your mask for two seconds.", good: false, issue: "covered" },
  { key: "cap", img: "no-glasses-cap", title: "No sunglasses or cap", body: "Take them off so your eyes and forehead show.", good: false, issue: "covered" },
  { key: "backlit", img: "no-backlight", title: "No bright window behind", body: "Your face goes dark and can’t be read.", good: false, issue: "backlit" },
  { key: "far", img: "too-far", title: "Not too far", body: "Come close enough to fill the oval.", good: false, issue: "far" },
  { key: "two", img: "one-person", title: "One person at a time", body: "Others step out of the camera’s view.", good: false, issue: "two" },
  { key: "turned", img: "look-straight", title: "Don’t look away", body: "Eyes on the screen, not on your phone.", good: false, issue: "turned" },
];

const ISSUE_TIP: Partial<Record<FaceIssue, Tip>> = {
  covered: FACE_TIPS[2],
  backlit: FACE_TIPS[4],
  dark: { ...FACE_TIPS[1], good: false, title: "Too dark", body: "Turn towards a window or lamp so your face is lit." },
  far: FACE_TIPS[5],
  two: FACE_TIPS[6],
  turned: FACE_TIPS[7],
};

function Badge({ good }: { good: boolean }) {
  return (
    <span
      className={cn(
        "absolute top-2 left-2 grid size-7 place-items-center rounded-full text-white shadow-sm ring-2 ring-white",
        good ? "bg-success" : "bg-destructive",
      )}
      aria-label={good ? "Do" : "Don’t"}
    >
      {good ? <Check className="size-4" /> : <X className="size-4" />}
    </span>
  );
}

/** The full checklist, shown before scanning. */
export function FaceGuideGrid({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <ul className={cn("grid gap-2.5", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4", className)}>
      {FACE_TIPS.map((t) => (
        <li key={t.key} className="overflow-hidden rounded-xl border bg-card">
          <div className="relative aspect-square bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brand/face-guide/${t.img}.webp`} alt="" className="size-full object-cover" loading="lazy" />
            <Badge good={t.good} />
          </div>
          <div className={cn("p-2", compact && "p-1.5")}>
            <p className={cn("leading-tight font-semibold", compact ? "text-[11px]" : "text-xs")}>{t.title}</p>
            {!compact && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.body}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One live tip for what the camera sees right now (e.g. a mask). Renders nothing for issues without a picture. */
export function FaceIssueCard({ issue, className, dark = false }: { issue: FaceIssue; className?: string; dark?: boolean }) {
  const tip = ISSUE_TIP[issue];
  if (!tip) return null;
  return (
    <div
      role="status"
      className={cn("flex items-center gap-3 rounded-2xl p-2.5 pr-4 shadow-lg", dark ? "bg-white/95 text-zinc-900" : "border bg-card", className)}
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/brand/face-guide/${tip.img}.webp`} alt="" className="size-full object-cover" />
        <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-destructive text-white ring-2 ring-white">
          <X className="size-3" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{tip.title}</span>
        <span className="block text-xs text-zinc-600">{tip.body}</span>
      </span>
    </div>
  );
}
