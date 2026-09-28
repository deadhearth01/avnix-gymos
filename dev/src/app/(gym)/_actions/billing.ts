"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { safe, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { PAY_METHODS } from "@/lib/appwrite/schema";
import { recordPayment, sellMembership, voidInvoice } from "@/lib/services/gym";
import { inr } from "@/lib/format";

const sellSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().min(1, "Choose a plan"),
  startAt: z.string().optional(),
  discount: z.coerce.number().min(0).max(1_000_000).optional(),
  includeJoiningFee: z.boolean().optional(),
  payment: z
    .object({ amount: z.coerce.number().min(0).max(10_000_000), method: z.enum(PAY_METHODS), reference: zOptStr(64) })
    .nullable()
    .optional(),
  idempotencyKey: z.uuid().optional(),
});

export async function sellMembershipAction(payload: z.input<typeof sellSchema>) {
  return safe(async () => {
    const ctx = await requireCap("billing.collect");
    const d = sellSchema.parse(payload);
    const r = await sellMembership(
      ctx.gym,
      { ...d, payment: d.payment?.amount ? { amount: d.payment.amount, method: d.payment.method, reference: d.payment.reference } : null },
      { $id: ctx.user.$id, name: ctx.user.name || ctx.user.email },
    );
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "membership.sell",
      entity: "invoice",
      entityId: r.invoice.$id,
      summary: `${r.member.name}: ${r.membership.planName} · ${r.invoice.number} · ${inr(r.invoice.total)}${r.payment ? ` · paid ${inr(r.payment.amount)}` : ""}`,
    });
    revalidatePath(`/members/${d.memberId}`);
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { invoiceId: r.invoice.$id, number: r.invoice.number, balance: r.invoice.balance };
  }, "Plan added");
}

const paySchema = z.object({
  memberId: z.string().min(1),
  amount: z.coerce.number().positive("Enter an amount").max(10_000_000),
  method: z.enum(PAY_METHODS),
  reference: zOptStr(64),
  invoiceId: zOptStr(36),
  note: zOptStr(500),
  idempotencyKey: z.uuid().optional(),
});

export async function recordPaymentAction(payload: z.input<typeof paySchema>) {
  return safe(async () => {
    const ctx = await requireCap("billing.collect");
    const d = paySchema.parse(payload);
    const r = await recordPayment(ctx.gym, d, { $id: ctx.user.$id, name: ctx.user.name || ctx.user.email });
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "payment.record",
      entity: "payment",
      entityId: r.payment.$id,
      summary: `${r.member.name}: ${inr(d.amount)} via ${d.method}`,
    });
    revalidatePath(`/members/${d.memberId}`);
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { paymentId: r.payment.$id, balance: r.member.balanceDue };
  }, "Payment recorded");
}

export async function voidInvoiceAction(invoiceId: string) {
  return safe(async () => {
    const ctx = await requireCap("billing.void");
    const inv = await voidInvoice(ctx.gymId, invoiceId);
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "invoice.void",
      entity: "invoice",
      entityId: invoiceId,
      summary: `${inv.number} (${inv.memberName})`,
    });
    revalidatePath("/billing");
    revalidatePath(`/members/${inv.memberId}`);
  }, "Invoice voided");
}
