"use client";

import * as React from "react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { Download, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";

/** Digital membership card with a QR the front desk can scan. */
export function MemberCard({
  open,
  onClose,
  gymName,
  member,
}: {
  open: boolean;
  onClose: () => void;
  gymName: string;
  member: { name: string; code: string | null; phone: string; planName: string | null; expiresAt: string | null };
}) {
  const [svg, setSvg] = React.useState("");
  const payload = `gymos:member:${member.code ?? ""}`;
  React.useEffect(() => {
    if (!open || !member.code) return;
    let alive = true;
    QRCode.toString(payload, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0a0a0b", light: "#ffffff" } }).then(
      (s) => alive && setSvg(s),
    );
    return () => {
      alive = false;
    };
  }, [open, payload, member.code]);

  const download = async () => {
    const url = await QRCode.toDataURL(payload, { width: 720, margin: 2 });
    Object.assign(document.createElement("a"), { href: url, download: `${member.code}-qr.png` }).click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">Member card</DialogTitle>
        <DialogDescription className="sr-only">QR code for check-in</DialogDescription>
        <motion.div
          initial={{ rotateX: 18, y: 12, opacity: 0 }}
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          style={{ perspective: 800 }}
          className="relative overflow-hidden rounded-3xl bg-[#0b0f0c] p-5 text-white"
        >
          <div className="absolute -top-24 -right-20 size-64 rounded-full bg-[radial-gradient(circle,rgb(34_197_94/0.45),transparent_65%)]" />
          <p className="relative text-[11px] font-medium tracking-[0.2em] text-white/60 uppercase">{gymName}</p>
          <p className="relative mt-1 text-xl font-semibold">{member.name}</p>
          <p className="relative text-sm text-white/60">
            {member.planName ?? "Member"} {member.expiresAt ? `· valid till ${fmtDate(member.expiresAt)}` : ""}
          </p>
          <div className="relative mx-auto mt-5 w-48 rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="relative mt-3 text-center font-mono text-lg font-semibold tracking-[0.3em]">{member.code}</p>
          <p className="relative text-center text-[11px] text-white/50">Show this at the front desk to check in</p>
        </motion.div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={download}>
            <Download /> Save QR
          </Button>
          <Button className="flex-1" asChild>
            <a
              href={waLink(member.phone, `Your ${gymName} member code is ${member.code}. Show it at the front desk to check in 💪`) ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Send code
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
