import type { Invoice, Payment } from "@/lib/types";

const TZ = "Asia/Kolkata";
const monthKey = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(d));

export function billingSummary(invoices: Invoice[], payments: Payment[], now = new Date()) {
  const cur = monthKey(now);
  const prev = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  const live = invoices.filter((i) => i.status !== "void");
  const inMonth = (k: string) => live.filter((i) => monthKey(i.issuedAt) === k);
  const paidIn = (k: string) => payments.filter((p) => monthKey(p.paidAt) === k).reduce((s, p) => s + p.amount, 0);
  const gst = (list: Invoice[]) => list.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
  const methods = ["upi", "cash", "card", "bank", "other"].map((m) => ({
    method: m,
    amount: payments.filter((p) => monthKey(p.paidAt) === cur && p.method === m).reduce((s, p) => s + p.amount, 0),
  }));
  return {
    collected: paidIn(cur),
    collectedPrev: paidIn(prev),
    invoiced: inMonth(cur).reduce((s, i) => s + i.total, 0),
    invoicedCount: inMonth(cur).length,
    gstThisMonth: gst(inMonth(cur)),
    taxableThisMonth: inMonth(cur).reduce((s, i) => s + i.taxable, 0),
    outstanding: live.reduce((s, i) => s + i.balance, 0),
    unpaidCount: live.filter((i) => i.balance > 0).length,
    methods,
    monthLabel: new Intl.DateTimeFormat("en-IN", { timeZone: TZ, month: "long", year: "numeric" }).format(now),
  };
}
