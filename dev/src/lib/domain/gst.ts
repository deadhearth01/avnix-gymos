import type { InvoiceItem } from "@/lib/types";

export const SAC_FITNESS = "999723"; // Physical well-being services incl. health club & fitness centre

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * GST breakdown for an invoice.
 * - Gym services: 5% without ITC since 22 Sep 2025 (configurable per gym).
 * - `inclusive` → item prices already include GST (common for Indian gyms).
 * - Intra-state (same state code) → CGST + SGST; inter-state → IGST.
 */
export function computeInvoice({
  items,
  discount = 0,
  rate,
  inclusive,
  interState = false,
}: {
  items: InvoiceItem[];
  discount?: number;
  rate: number;
  inclusive: boolean;
  interState?: boolean;
}) {
  const gross = r2(items.reduce((s, i) => s + i.amount, 0));
  const disc = Math.min(Math.max(0, r2(discount)), gross);
  const afterDiscount = r2(gross - disc);
  const taxable = inclusive ? r2(afterDiscount / (1 + rate / 100)) : afterDiscount;
  const tax = inclusive ? r2(afterDiscount - taxable) : r2((taxable * rate) / 100);
  const half = r2(tax / 2);
  const total = r2(taxable + tax);
  return {
    subtotal: gross,
    discount: disc,
    taxable,
    taxRate: rate,
    cgst: interState ? 0 : half,
    sgst: interState ? 0 : r2(tax - half),
    igst: interState ? tax : 0,
    total,
  };
}

export function paymentStatus(total: number, paid: number): "paid" | "partial" | "unpaid" {
  if (paid >= total - 0.005) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

/** Indian number-to-words for invoice totals (rupees only). */
export function rupeesInWords(amount: number) {
  const n = Math.round(amount);
  if (n === 0) return "Zero rupees only";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ""}`);
  const three = (x: number) => (x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${two(x % 100)}` : ""}` : two(x));
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return `${parts.join(" ")} rupees only`;
}
