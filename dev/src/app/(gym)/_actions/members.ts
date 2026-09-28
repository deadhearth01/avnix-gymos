"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { UserError } from "@/lib/actions";
import { safe, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { repo } from "@/lib/data/repo";
import { T, GENDER, LANGS, LEAD_SOURCES, PAY_METHODS } from "@/lib/appwrite/schema";
import { createMember, freezeMember, sellMembership, unfreezeMember, updateMember } from "@/lib/services/gym";
import type { Member } from "@/lib/types";

const memberSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(128),
  phone: z.string().trim().min(10, "Enter a 10-digit mobile number").max(20),
  email: z.union([z.email("Enter a valid email"), z.literal("")]).optional(),
  gender: z.enum(GENDER).optional(),
  dob: z.string().optional(),
  lang: z.enum(LANGS).optional(),
  goal: zOptStr(64),
  address: zOptStr(500),
  emergencyName: zOptStr(128),
  emergencyPhone: zOptStr(20),
  notes: zOptStr(2000),
  source: z.enum(LEAD_SOURCES).optional(),
  trainerName: zOptStr(128),
  whatsappOptIn: z.boolean().optional(),
});

const saleSchema = z
  .object({
    planId: z.string().min(1, "Choose a plan"),
    startAt: z.string().optional(),
    discount: z.coerce.number().min(0).max(1_000_000).optional(),
    payment: z
      .object({ amount: z.coerce.number().min(0).max(10_000_000), method: z.enum(PAY_METHODS), reference: zOptStr(64) })
      .nullable()
      .optional(),
    idempotencyKey: z.uuid().optional(),
  })
  .nullable()
  .optional();

export async function createMemberAction(payload: { member: z.input<typeof memberSchema>; sale?: z.input<typeof saleSchema> }) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    const input = memberSchema.parse(payload.member);
    const sale = saleSchema.parse(payload.sale);
    const actor = { $id: ctx.user.$id, name: ctx.user.name || ctx.user.email };
    const member = await createMember(ctx.gym, { ...input, email: input.email || undefined }, actor);
    let invoiceId: string | undefined;
    if (sale) {
      if (!can(ctx.role, "billing.collect")) throw new UserError("You can add members but not bill them.");
      const r = await sellMembership(
        ctx.gym,
        {
          memberId: member.$id,
          planId: sale.planId,
          startAt: sale.startAt,
          discount: sale.discount,
          payment: sale.payment?.amount ? { amount: sale.payment.amount, method: sale.payment.method, reference: sale.payment.reference } : null,
          idempotencyKey: sale.idempotencyKey,
        },
        actor,
      );
      invoiceId = r.invoice.$id;
    }
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "member.create",
      entity: "member",
      entityId: member.$id,
      summary: `${member.name} (${member.code})${sale ? " + plan" : ""}`,
    });
    revalidatePath("/members");
    revalidatePath("/dashboard");
    return { id: member.$id, invoiceId };
  }, "Member added");
}

export async function updateMemberAction(id: string, payload: z.input<typeof memberSchema>) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    const input = memberSchema.partial().parse(payload);
    await updateMember(ctx.gymId, id, { ...input, email: input.email === "" ? "" : input.email });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "member.update", entity: "member", entityId: id, summary: Object.keys(input).join(", ") });
    revalidatePath(`/members/${id}`);
    revalidatePath("/members");
  }, "Saved");
}

export async function setMemberArchivedAction(id: string, archived: boolean) {
  return safe(
    async () => {
      const ctx = await requireCap("members.delete");
      const r = repo(ctx.gymId);
      const m = await r.get<Member>(T.members, id);
      await r.update(T.members, id, { status: archived ? "cancelled" : m.expiresAt && new Date(m.expiresAt) > new Date() ? "active" : "expired" });
      await audit({
        gymId: ctx.gymId,
        actor: ctx.user,
        action: archived ? "member.archive" : "member.restore",
        entity: "member",
        entityId: id,
        summary: m.name,
      });
      revalidatePath(`/members/${id}`);
      revalidatePath("/members");
    },
    archived ? "Member archived" : "Member restored",
  );
}

export async function freezeMemberAction(id: string, days: number, reason?: string) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    const m = await freezeMember(ctx.gymId, id, Math.round(days), reason?.slice(0, 200));
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "member.freeze", entity: "member", entityId: id, summary: `${m.name} frozen ${days} days` });
    revalidatePath(`/members/${id}`);
  }, "Membership frozen — expiry extended");
}

export async function unfreezeMemberAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    const m = await unfreezeMember(ctx.gymId, id);
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "member.unfreeze", entity: "member", entityId: id, summary: m.name });
    revalidatePath(`/members/${id}`);
  }, "Welcome back — membership resumed");
}
