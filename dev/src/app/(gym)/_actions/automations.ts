"use server";

import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { safe, UserError } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { repo } from "@/lib/data/repo";
import { CHANNELS, T } from "@/lib/appwrite/schema";
import { PLAYBOOK_BY_KEY, type PlaybookKey } from "@/lib/domain/playbooks";
import { deliverMessage, runJourneysForGym } from "@/lib/services/messages";
import type { Automation, Message } from "@/lib/types";

async function autoRow(gymId: string, key: string) {
  const r = repo(gymId);
  const row = (await r.list<Automation>(T.automations, [Query.equal("key", key), Query.limit(1)], false)).rows[0];
  if (row) return row;
  if (!(key in PLAYBOOK_BY_KEY)) throw new UserError("Unknown automation.");
  const def = PLAYBOOK_BY_KEY[key as PlaybookKey];
  return r.create<Automation>(T.automations, {
    key,
    enabled: def.defaultEnabled,
    channel: "whatsapp",
    config: JSON.stringify({ offsets: def.defaultOffsets ?? [] }),
  });
}

export async function toggleAutomationAction(key: string, enabled: boolean) {
  return safe(
    async () => {
      const ctx = await requireCap("automations.manage");
      const row = await autoRow(ctx.gymId, key);
      await repo(ctx.gymId).update(T.automations, row.$id, { enabled });
      await audit({
        gymId: ctx.gymId,
        actor: ctx.user,
        action: enabled ? "automation.enable" : "automation.disable",
        entity: "automation",
        entityId: row.$id,
        summary: key,
      });
      revalidatePath("/automations");
    },
    enabled ? "Automation on" : "Automation paused",
  );
}

const cfgSchema = z.object({
  templateEn: z.string().trim().max(1000).optional(),
  templateTe: z.string().trim().max(1000).optional(),
  channel: z.enum(CHANNELS),
  offsets: z.array(z.coerce.number().int().min(0).max(365)).max(6).optional(),
  contentSid: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^HX[0-9a-fA-F]{32}$/.test(v), "Content SID starts with HX"),
});

export async function saveAutomationAction(key: string, payload: z.input<typeof cfgSchema>) {
  return safe(async () => {
    const ctx = await requireCap("automations.manage");
    const d = cfgSchema.parse(payload);
    const row = await autoRow(ctx.gymId, key);
    await repo(ctx.gymId).update(T.automations, row.$id, {
      templateEn: d.templateEn || null,
      templateTe: d.templateTe || null,
      channel: d.channel,
      config: JSON.stringify({ offsets: d.offsets ?? [], contentSid: d.contentSid || undefined }),
    });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "automation.update", entity: "automation", entityId: row.$id, summary: key });
    revalidatePath("/automations");
  }, "Automation saved");
}

export async function runJourneysNowAction() {
  return safe(async () => {
    const ctx = await requireCap("automations.manage");
    const r = await runJourneysForGym(ctx.gym, { maxSend: 50 });
    revalidatePath("/automations");
    return r;
  });
}

export async function sendMessageAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("messages.send");
    const m = await deliverMessage(ctx.gym, id);
    revalidatePath("/automations");
    if (m.status === "failed") throw new UserError(m.error ?? "Sending failed");
    return { status: m.status };
  }, "Sent");
}

/** Staff sent it themselves from WhatsApp (wa.me link) — record it. */
export async function markMessageManualAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("messages.send");
    await repo(ctx.gymId).update<Message>(T.messages, id, { status: "manual", sentAt: new Date().toISOString(), by: ctx.user.name });
    revalidatePath("/automations");
  });
}

export async function skipMessageAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("messages.send");
    await repo(ctx.gymId).update<Message>(T.messages, id, { status: "skipped", by: ctx.user.name });
    revalidatePath("/automations");
  }, "Skipped");
}
