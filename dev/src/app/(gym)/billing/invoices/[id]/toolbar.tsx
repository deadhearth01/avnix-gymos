"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Printer, Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { waLink } from "@/lib/whatsapp";

export function InvoiceToolbar({ number, phone }: { number: string; phone: string | null }) {
  function share() {
    const url = waLink(phone, `Your invoice ${number}: ${window.location.href}`);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else notify.error("No member phone number is available.");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify.success("Invoice link copied");
    } catch {
      notify.error("Could not copy the link.");
    }
  }
  return (
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" asChild>
        <Link href="/billing">
          <ArrowLeft /> Back to billing
        </Link>
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copy}>
          <Copy /> Copy link
        </Button>
        <Button variant="outline" onClick={share} disabled={!phone}>
          <Send /> Share on WhatsApp
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>
    </div>
  );
}
