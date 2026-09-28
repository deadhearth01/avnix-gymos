import "server-only";
import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { repo } from "@/lib/data/repo";
import { planJourneys, withinSendWindow } from "@/lib/domain/journeys";
import { PLAYBOOK_BY_KEY, type AutomationConfig, type PlaybookKey } from "@/lib/domain/playbooks";
import { isTwilioReady, sendTwilioMessage, TwilioError } from "@/lib/messaging/twilio";
import { env } from "@/lib/env";
import { withLock } from "@/lib/data/lock";
import { autoUnfreeze } from "@/lib/services/gym";
import type { Automation, Gym, Lead, Member, Message } from "@/lib/types";

function statusCallbackUrl() {
  const e = env();
  if (e.APP_URL.includes("localhost")) return undefined;
  return `${e.APP_URL.replace(/\/$/, "")}/api/webhooks/twilio`;
}

/** Sends one queued message through Twilio and records the outcome (exactly once). */
export async function deliverMessage(gym: Gym, messageId: string) {
  return withLock(`msg:${messageId}`, () => deliverMessageLocked(gym, messageId), 1500);
}

async function deliverMessageLocked(gym: Gym, messageId: string) {
  const r = repo(gym.$id);
  const msg = await r.get<Message>(T.messages, messageId);
  if (!["queued", "failed"].includes(msg.status)) return msg;
  if (!gym.messagingEnabled) throw new Error("Messaging is disabled for this gym.");
  if (!isTwilioReady()) throw new Error("Twilio is not configured.");
  if (!msg.phone) return r.update<Message>(T.messages, messageId, { status: "skipped", error: "No phone number" });

  await r.update(T.messages, messageId, { status: "sending" });
  const auto = (await r.list<Automation>(T.automations, [Query.equal("key", msg.playbook), Query.limit(1)], false)).rows[0];
  let cfg: AutomationConfig = {};
  try {
    cfg = auto?.config ? JSON.parse(auto.config) : {};
  } catch {}

  try {
    const res = await sendTwilioMessage({
      channel: msg.channel === "sms" ? "sms" : "whatsapp",
      to: msg.phone,
      body: msg.body,
      sender: gym,
      contentSid: msg.channel === "whatsapp" ? cfg.contentSid : undefined,
      contentVariables: cfg.contentSid ? { "1": msg.name.split(" ")[0], "2": gym.name } : undefined,
      statusCallback: statusCallbackUrl(),
    });
    return r.update<Message>(T.messages, messageId, { status: "sent", providerId: res.sid, sentAt: new Date().toISOString(), error: null, by: "Twilio" });
  } catch (e) {
    const err = e instanceof TwilioError ? `${e.message}${e.code ? ` (${e.code})` : ""}` : (e as Error).message;
    return r.update<Message>(T.messages, messageId, { status: "failed", error: err.slice(0, 1000) });
  }
}

/**
 * Runs the journey engine for one gym: materialises due messages (idempotent)
 * and, if auto-send is on and it's within the send window, delivers them.
 */
export async function runJourneysForGym(gym: Gym, opts: { deliver?: boolean; maxSend?: number } = {}) {
  const r = repo(gym.$id);
  await autoUnfreeze(gym.$id).catch((e) => console.error("[autoUnfreeze]", e));
  const [members, leads, automations] = await Promise.all([
    r.all<Member>(T.members, [Query.notEqual("status", "cancelled")]),
    r.all<Lead>(T.leads, [Query.equal("status", "trial_booked")]),
    r.all<Automation>(T.automations),
  ]);
  const drafts = planJourneys({ gym, automations, members, leads });
  let created = 0;
  for (const d of drafts) {
    const def = PLAYBOOK_BY_KEY[d.playbook as PlaybookKey];
    const auto = automations.find((a) => a.key === d.playbook);
    try {
      await r.create(T.messages, {
        memberId: d.memberId ?? null,
        leadId: d.leadId ?? null,
        name: d.name,
        phone: d.phone,
        playbook: d.playbook,
        channel: auto?.channel ?? "whatsapp",
        body: d.body,
        status: "queued",
        dueAt: new Date().toISOString(),
        dedupeKey: d.dedupeKey,
      });
      created++;
    } catch (e) {
      if ((e as { code?: number }).code !== 409) console.error("[journeys] create", def?.key, e);
    }
  }

  let sent = 0;
  let failed = 0;
  if ((opts.deliver ?? true) && gym.messagingEnabled && gym.autoSend && withinSendWindow()) {
    const queued = await r.list<Message>(T.messages, [Query.equal("status", "queued"), Query.orderAsc("dueAt"), Query.limit(opts.maxSend ?? 50)], false);
    for (const m of queued.rows) {
      const res = await deliverMessage(gym, m.$id).catch(() => null);
      if (res?.status === "sent") sent++;
      else failed++;
    }
  }
  const { tables } = adminClient();
  await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gym.$id, data: { journeysRunAt: new Date().toISOString() } }).catch(() => {});
  return { drafts: drafts.length, created, sent, failed };
}

/** Lazily run journeys when a dashboard loads, at most every 20 minutes per gym. */
export async function maybeRunJourneys(gym: Gym) {
  const last = gym.journeysRunAt ? new Date(gym.journeysRunAt).getTime() : 0;
  if (Date.now() - last < 20 * 60 * 1000) return null;
  return runJourneysForGym(gym, { maxSend: 20 });
}
