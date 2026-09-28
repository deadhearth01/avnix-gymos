"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Banknote, Check, CreditCard, Landmark, QrCode } from "@/components/icons";
import { AffixInput, Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { computeInvoice } from "@/lib/domain/gst";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PlanOption = {
  id: string;
  name: string;
  type: string;
  durationDays: number;
  sessions: number;
  price: number;
  joiningFee: number;
  color: string | null;
};
export type SaleState = {
  planId: string;
  startAt: string;
  discount: string;
  amount: string;
  amountTouched: boolean;
  method: "upi" | "cash" | "card" | "bank";
  reference: string;
};

export const initialSale = (planId = ""): SaleState => ({ planId, startAt: "", discount: "", amount: "", amountTouched: false, method: "upi", reference: "" });

const METHODS = [
  { value: "upi", label: "UPI", icon: QrCode },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "bank", label: "Bank", icon: Landmark },
] as const;

export function planDuration(p: Pick<PlanOption, "type" | "durationDays" | "sessions">) {
  if (p.type !== "duration") return `${p.sessions} sessions · ${p.durationDays}d`;
  const d = p.durationDays;
  if (d % 365 === 0) return `${d / 365} year${d > 365 ? "s" : ""}`;
  if (d % 30 === 0) return `${d / 30} month${d > 30 ? "s" : ""}`;
  return `${d} days`;
}

export function saleTotals(sale: SaleState, plans: PlanOption[], gst: { rate: number; inclusive: boolean }, withJoining: boolean) {
  const plan = plans.find((p) => p.id === sale.planId);
  if (!plan) return null;
  const items = [{ description: plan.name, qty: 1, rate: plan.price, amount: plan.price }];
  if (withJoining && plan.joiningFee > 0) items.push({ description: "Joining fee", qty: 1, rate: plan.joiningFee, amount: plan.joiningFee });
  const t = computeInvoice({ items, discount: Number(sale.discount) || 0, rate: gst.rate, inclusive: gst.inclusive });
  const paying = sale.amountTouched ? Math.min(Number(sale.amount) || 0, t.total) : t.total;
  return { plan, ...t, paying, balance: Math.max(0, Math.round((t.total - paying) * 100) / 100) };
}

/** Plan picker + start/discount + payment capture with a live GST summary. */
export function PlanSaleFields({
  plans,
  sale,
  onChange,
  gst,
  withJoining,
  showPayment = true,
}: {
  plans: PlanOption[];
  sale: SaleState;
  onChange: (s: SaleState) => void;
  gst: { rate: number; inclusive: boolean };
  withJoining: boolean;
  showPayment?: boolean;
}) {
  const t = saleTotals(sale, plans, gst, withJoining);
  const set = (patch: Partial<SaleState>) => onChange({ ...sale, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Plan" className="grid gap-2 sm:grid-cols-2">
        {plans.map((p) => {
          const active = p.id === sale.planId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ planId: p.id, amountTouched: false })}
              className={cn(
                "anim-host relative flex items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5",
                active ? "border-primary ring-4 ring-primary/10" : "hover:border-foreground/20",
              )}
            >
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: p.color ?? "var(--primary)" }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{planDuration(p)}</span>
              </span>
              <span className="tabular text-sm font-semibold">{inr(p.price)}</span>
              {active && (
                <motion.span
                  layoutId="plan-check"
                  className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow"
                >
                  <Check className="size-3" />
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date" hint="Blank = after current plan ends, or today">
          <Input type="date" value={sale.startAt} onChange={(e) => set({ startAt: e.target.value })} />
        </Field>
        <Field label="Discount">
          <AffixInput
            leading="₹"
            value={sale.discount}
            onChange={(e) => set({ discount: e.target.value.replace(/[^\d.]/g, ""), amountTouched: false })}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>
      </div>

      {showPayment && t && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <p className="mb-2 text-[13px] font-medium">Payment now</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount received" hint={t.balance > 0 ? `${inr(t.balance)} will be added as dues` : "Paid in full"}>
              <AffixInput
                leading="₹"
                value={sale.amountTouched ? sale.amount : String(t.total)}
                onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, ""), amountTouched: true })}
                inputMode="decimal"
              />
            </Field>
            <Field label="Reference" optional hint="UPI ref / card last 4">
              <Input value={sale.reference} onChange={(e) => set({ reference: e.target.value.slice(0, 64) })} placeholder="e.g. 4271 9910 2231" />
            </Field>
          </div>
          <div role="radiogroup" aria-label="Payment method" className="mt-3 grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={sale.method === m.value}
                onClick={() => set({ method: m.value })}
                className={cn(
                  "anim-host flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border bg-card text-xs font-medium transition-colors",
                  sale.method === m.value ? "border-primary bg-success-soft/50 text-success-ink" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <m.icon className="size-4" />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {t && (
        <dl className="grid gap-1.5 rounded-xl border p-3 text-sm">
          <Line label={`${t.plan.name}${withJoining && t.plan.joiningFee ? " + joining" : ""}`} value={inr(t.subtotal)} />
          {t.discount > 0 && <Line label="Discount" value={`− ${inr(t.discount)}`} />}
          <Line label={`Taxable value`} value={inr(t.taxable, true)} muted />
          <Line label={`CGST ${t.taxRate / 2}% + SGST ${t.taxRate / 2}%`} value={inr(t.cgst + t.sgst, true)} muted />
          <div className="my-1 border-t" />
          <Line label="Total" value={inr(t.total, true)} strong />
          {showPayment && t.balance > 0 && <Line label="Balance due" value={inr(t.balance, true)} danger />}
        </dl>
      )}
    </div>
  );
}

function Line({ label, value, muted, strong, danger }: { label: string; value: string; muted?: boolean; strong?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn(muted && "text-muted-foreground", strong && "font-semibold")}>{label}</dt>
      <dd className={cn("tabular", strong && "text-base font-semibold", muted && "text-muted-foreground", danger && "font-medium text-danger-ink")}>{value}</dd>
    </div>
  );
}
