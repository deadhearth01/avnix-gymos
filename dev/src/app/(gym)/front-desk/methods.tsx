"use client";

import { CreditCard, Fingerprint, HandTap, Monitor, QrCode, ScanFace, type IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";

/* ─────────────────────────── how someone checked in ─────────────────────────── */

export type MethodKey = "manual" | "qr" | "face" | "fingerprint" | "card" | "kiosk" | "biometric";
export const METHODS: Record<MethodKey, { label: string; long: string; icon: IconComponent; bar: string; text: string }> = {
  manual: { label: "Desk", long: "Checked in at the desk", icon: HandTap, bar: "bg-primary", text: "text-primary" },
  qr: { label: "QR", long: "Scanned their QR code", icon: QrCode, bar: "bg-lime", text: "text-lime-ink" },
  face: { label: "Face ID", long: "Recognised by Face ID", icon: ScanFace, bar: "bg-violet", text: "text-violet-ink" },
  fingerprint: { label: "Fingerprint", long: "Fingerprint on the machine", icon: Fingerprint, bar: "bg-info", text: "text-info-ink" },
  card: { label: "Card", long: "Tapped their card on the machine", icon: CreditCard, bar: "bg-warning", text: "text-warning-ink" },
  kiosk: { label: "Kiosk", long: "Checked in on the kiosk", icon: Monitor, bar: "bg-violet", text: "text-violet-ink" },
  biometric: { label: "Machine", long: "Checked in on the attendance machine", icon: Fingerprint, bar: "bg-info", text: "text-info-ink" },
};
export const methodOf = (m: string) => METHODS[(m in METHODS ? m : "manual") as MethodKey];
export const methodKey = (m: string) => (m in METHODS ? m : "manual") as MethodKey;

/** "Recognised by Face ID · Face kiosk" / "Checked in at the desk · by Ravi Teja" */
export function howText(c: { method: string; by: string | null }) {
  const m = methodOf(c.method);
  if (!c.by) return m.long;
  return c.method === "manual" || c.method === "qr" ? `${m.long} by ${c.by}` : `${m.long} · ${c.by}`;
}

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const m = methodOf(method);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium", m.text, className)}>
      <m.icon className="size-3.5" />
      {m.label}
    </span>
  );
}
