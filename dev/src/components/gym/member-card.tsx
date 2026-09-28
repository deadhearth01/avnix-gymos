"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import { BadgeCheck, Download, Printer } from "@/components/icons";
import { ProfileCard } from "@/components/site/profile-card";
import { BrandIcon } from "@/components/brand/social-icons";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { fmtDate } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";

export type MemberCardData = {
  name: string;
  code: string | null;
  phone: string;
  status: string;
  planName: string | null;
  goal: string | null;
  trainerName: string | null;
  startAt: string | null;
  expiresAt: string | null;
  /** Percent (0–100) of the current plan already used. */
  progress: number | null;
  daysLeft: number | null;
  visits30: number;
  streak: number;
};

const STATUS_LABEL: Record<string, string> = { active: "Active", frozen: "On hold", expired: "Expired", cancelled: "Cancelled", none: "No plan" };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Digital membership card: who the member is, how much of the plan is left, and a QR the front desk scans. */
export function MemberCard({ open, onClose, gymName, member }: { open: boolean; onClose: () => void; gymName: string; member: MemberCardData }) {
  const [svg, setSvg] = React.useState("");
  const reduced = useReducedMotion();
  const payload = `gymos:member:${member.code ?? ""}`;

  React.useEffect(() => {
    if (!open || !member.code) return;
    let alive = true;
    QRCode.toString(payload, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#111214", light: "#ffffff" } }).then(
      (s) => alive && setSvg(s),
    );
    return () => {
      alive = false;
    };
  }, [open, payload, member.code]);

  const download = async () => {
    const url = await QRCode.toDataURL(payload, { width: 900, margin: 2 });
    Object.assign(document.createElement("a"), { href: url, download: `${member.code}-qr.png` }).click();
  };

  const active = member.status === "active";
  const pct = Math.round(Math.min(100, Math.max(0, member.progress ?? 0)));
  const whatsapp = waLink(
    member.phone,
    `Hi ${member.name.split(" ")[0]}, your ${gymName} member code is ${member.code}. Show it at the front desk to check in.`,
  );
  const chips = [member.planName, member.goal, member.trainerName ? `Coach ${member.trainerName}` : null].filter(Boolean) as string[];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-h-[94dvh] overflow-y-auto p-0 sm:max-w-[820px] max-md:[&>[data-slot=dialog-close]]:text-white">
        <DialogTitle className="sr-only">Membership card for {member.name}</DialogTitle>
        <DialogDescription className="sr-only">Member details, plan progress and the QR code used to check in.</DialogDescription>
        <div className="grid md:grid-cols-[340px_minmax(0,1fr)]">
          {/* Holographic membership card (React Bits ProfileCard engine): tilt, holo shine, glare, cursor glow */}
          <div className="relative grid place-items-center overflow-hidden bg-[#0d0e11] p-6 max-md:rounded-t-[inherit] md:rounded-l-[inherit] md:p-7">
            <div aria-hidden className="absolute -top-24 -left-20 size-72 rounded-full bg-primary/35 blur-3xl" />
            <ProfileCard brand="var(--primary)" name={member.name} title={member.planName ?? "Member"} aspect={0.64} vivid className="w-full max-w-[290px]">
              <div className="flex h-full flex-col p-5 text-white">
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-white/75">
                  <span className="truncate">{gymName}</span>
                  <span className="shrink-0 rounded-full border border-white/20 px-2 py-0.5">{STATUS_LABEL[member.status] ?? "Member"}</span>
                </div>
                <div className="mt-6 flex flex-col items-center text-center">
                  <span className="grid size-[72px] place-items-center rounded-full bg-white/12 font-display text-2xl font-bold ring-1 ring-white/30 backdrop-blur-md">
                    {initials(member.name)}
                  </span>
                  <p className="mt-3 line-clamp-2 font-display text-[22px] leading-tight font-bold tracking-tight">{member.name}</p>
                  <p className="mt-1 text-xs text-white/70">
                    {member.planName ?? "No plan"}
                    {member.expiresAt ? ` · till ${fmtDate(member.expiresAt, "dd MMM yy")}` : ""}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-xl">
                  <div
                    role="img"
                    aria-label={`QR code for member ${member.code}`}
                    className="size-[104px] shrink-0 rounded-xl bg-white p-2 [&_svg]:size-full"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-semibold tracking-[0.12em]">{member.code ?? "—"}</p>
                    <p className="mt-1 text-[11px] leading-snug text-white/65">Scan at the front desk, or say this code</p>
                  </div>
                </div>
              </div>
            </ProfileCard>
          </div>

          {/* Profile */}
          <div className="p-6 sm:p-7">
            <p className="text-xs font-medium text-muted-foreground">{gymName}</p>
            <p className="mt-4 flex items-center gap-1.5 font-display text-2xl font-bold tracking-tight">
              <span className="truncate">{member.name}</span>
              {active && <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Active member" />}
            </p>
            <p className="text-sm text-muted-foreground">
              {active ? "Active member" : member.status === "frozen" ? "Membership on hold" : "Membership inactive"}
              {member.startAt ? ` since ${fmtDate(member.startAt, "dd MMM yyyy")}` : ""}
            </p>

            {chips.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <li key={chip} className="rounded-full border px-3 py-1 text-xs font-medium">
                    {chip}
                  </li>
                ))}
              </ul>
            )}

            {member.expiresAt && (
              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {member.daysLeft == null ? "Plan" : member.daysLeft > 0 ? `${member.daysLeft} day${member.daysLeft === 1 ? "" : "s"} left` : "Plan ended"}
                  </span>
                  <span className="text-muted-foreground">Valid till {fmtDate(member.expiresAt, "dd MMM yyyy")}</span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Plan used"
                >
                  <motion.div
                    className={cn("h-full rounded-full", (member.daysLeft ?? 99) <= 7 ? "bg-warning" : "bg-primary")}
                    initial={reduced ? false : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            )}

            <dl className="mt-6 grid grid-cols-3 divide-x rounded-xl border text-center">
              <div className="px-2 py-3">
                <dt className="text-xs text-muted-foreground">Visits · 30d</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{member.visits30}</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-xs text-muted-foreground">Streak</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{member.streak}d</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-xs text-muted-foreground">Code</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold">{member.code ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              {whatsapp && (
                <Button asChild className="flex-1">
                  <a href={whatsapp} target="_blank" rel="noreferrer">
                    <BrandIcon name="whatsapp" className="size-4" /> Send on WhatsApp
                  </a>
                </Button>
              )}
              <Button variant="outline" size="icon" aria-label="Download QR code" onClick={download} disabled={!member.code}>
                <Download />
              </Button>
              <Button variant="outline" size="icon" aria-label="Print card" onClick={() => window.print()}>
                <Printer />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
