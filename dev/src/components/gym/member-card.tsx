"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import { BadgeCheck, ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
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
  const [slide, setSlide] = React.useState(0);
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
  const slides = ["qr", "code"] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setSlide(0);
        }
      }}
    >
      <DialogContent className="max-h-[94dvh] overflow-y-auto p-0 sm:max-w-[760px] md:[&>[data-slot=dialog-close]]:text-white md:[&>[data-slot=dialog-close]]:hover:bg-white/10">
        <DialogTitle className="sr-only">Membership card for {member.name}</DialogTitle>
        <DialogDescription className="sr-only">Member details, plan progress and the QR code used to check in.</DialogDescription>
        <div className="grid md:grid-cols-[1fr_300px]">
          {/* Profile */}
          <div className="p-6 sm:p-7">
            <p className="text-xs font-medium text-muted-foreground">{gymName}</p>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/12 font-display text-xl font-bold text-primary ring-4 ring-primary/8">
                {initials(member.name)}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
                  <span className="truncate">{member.name}</span>
                  {active && <BadgeCheck className="size-5 shrink-0 fill-primary text-primary-foreground" aria-label="Active member" />}
                </p>
                <p className="text-sm text-muted-foreground">
                  {active ? "Active member" : member.status === "frozen" ? "Membership on hold" : "Membership inactive"}
                  {member.startAt ? ` since ${fmtDate(member.startAt, "dd MMM yyyy")}` : ""}
                </p>
              </div>
            </div>

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

          {/* Carousel: QR and manual code */}
          <div className="relative flex flex-col bg-[#111214] p-6 text-white max-md:rounded-b-[inherit] md:rounded-r-[inherit]">
            <div className="flex items-center text-xs text-white/60">
              <span className="md:pr-10">{slide === 0 ? "Scan at the front desk" : "Or type this code"}</span>
            </div>
            <div className="relative grid flex-1 place-items-center py-6">
              <AnimatePresence mode="wait" initial={false}>
                {slide === 0 ? (
                  <motion.div
                    key="qr"
                    initial={reduced ? false : { opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? undefined : { opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                    className="w-full max-w-[220px] rounded-2xl bg-white p-4 [&_svg]:h-auto [&_svg]:w-full"
                    aria-label={`QR code for member ${member.code}`}
                    role="img"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <motion.div
                    key="code"
                    initial={reduced ? false : { opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? undefined : { opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                    className="text-center"
                  >
                    <p className="font-mono text-4xl font-semibold tracking-[0.18em]">{member.code ?? "—"}</p>
                    <p className="mt-3 text-sm text-white/60">Front desk can enter this code or search by phone number.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => setSlide((s) => (s + slides.length - 1) % slides.length)}
                className="grid size-10 place-items-center rounded-full hover:bg-white/10"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="flex gap-1.5" aria-hidden>
                {slides.map((s, i) => (
                  <span key={s} className={cn("h-1.5 rounded-full bg-white transition-all", i === slide ? "w-5" : "w-1.5 opacity-40")} />
                ))}
              </span>
              <button
                type="button"
                aria-label="Next"
                onClick={() => setSlide((s) => (s + 1) % slides.length)}
                className="grid size-10 place-items-center rounded-full hover:bg-white/10"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
