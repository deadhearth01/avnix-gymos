"use server";

import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { safe, UserError, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { repo } from "@/lib/data/repo";
import { bumpStat } from "@/lib/data/stats";
import { LEAD_SOURCES, LEAD_STATUS, T } from "@/lib/appwrite/schema";
import { convertLead } from "@/lib/services/gym";
import { toE164 } from "@/lib/format";
import type { Lead } from "@/lib/types";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(128),
  phone: z.string().trim().min(10, "Enter a 10-digit mobile number"),
  email: z.union([z.email(), z.literal("")]).optional(),
  source: z.enum(LEAD_SOURCES).default("walkin"),
  goal: zOptStr(64),
  status: z.enum(LEAD_STATUS).default("new"),
  trialAt: zOptStr(40),
  followUpAt: zOptStr(40),
  notes: zOptStr(2000),
});

const iso = (v?: string) => (v ? new Date(v).toISOString() : null);

export async function createLeadAction(payload: z.input<typeof leadSchema>) {
  return safe(async () => {
    const ctx = await requireCap("leads.edit");
    const d = leadSchema.parse(payload);
    const phone = toE164(d.phone);
    if (!phone) throw new UserError("Enter a valid 10-digit mobile number.");
    const r = repo(ctx.gymId);
    const dupe = (await r.list<Lead>(T.leads, [Query.equal("phone", phone), Query.notEqual("status", "lost"), Query.limit(1)], false)).rows[0];
    if (dupe && dupe.status !== "joined") throw new UserError(`${dupe.name} is already in your pipeline.`);
    const lead = await r.create<Lead>(T.leads, {
      name: d.name,
      phone,
      email: d.email || null,
      source: d.source,
      goal: d.goal ?? null,
      status: d.trialAt && d.status === "new" ? "trial_booked" : d.status,
      trialAt: iso(d.trialAt),
      followUpAt: iso(d.followUpAt),
      notes: d.notes ?? null,
      assignedTo: ctx.user.$id,
      assignedName: ctx.user.name,
    });
    await bumpStat(ctx.gymId, { leads: 1 });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "lead.create", entity: "lead", entityId: lead.$id, summary: lead.name });
    revalidatePath("/leads");
    return { id: lead.$id };
  }, "Lead added");
}

export async function updateLeadAction(id: string, payload: Partial<z.input<typeof leadSchema>> & { lostReason?: string }) {
  return safe(async () => {
    const ctx = await requireCap("leads.edit");
    const d = leadSchema
      .partial()
      .extend({ lostReason: zOptStr(128) })
      .parse(payload);
    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.phone !== undefined) {
      const p = toE164(d.phone);
      if (!p) throw new UserError("Enter a valid 10-digit mobile number.");
      data.phone = p;
    }
    if (d.status !== undefined) data.status = d.status;
    if (d.source !== undefined) data.source = d.source;
    if ("goal" in payload) data.goal = d.goal ?? null;
    if ("notes" in payload) data.notes = d.notes ?? null;
    if ("trialAt" in payload) data.trialAt = iso(d.trialAt);
    if ("followUpAt" in payload) data.followUpAt = iso(d.followUpAt);
    if ("lostReason" in payload) data.lostReason = d.lostReason ?? null;
    await repo(ctx.gymId).update(T.leads, id, data);
    revalidatePath("/leads");
  });
}

export async function convertLeadAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    const r = await convertLead(ctx.gym, id, { $id: ctx.user.$id, name: ctx.user.name || ctx.user.email });
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "lead.convert",
      entity: "lead",
      entityId: id,
      summary: `${r.lead.name} → member ${r.member.code}`,
    });
    revalidatePath("/leads");
    revalidatePath("/members");
    return { memberId: r.member.$id };
  }, "Converted to member");
}

export async function deleteLeadAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("leads.edit");
    await repo(ctx.gymId).remove(T.leads, id);
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "lead.delete", entity: "lead", entityId: id });
    revalidatePath("/leads");
  }, "Lead removed");
}
