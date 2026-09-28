import "server-only";
import { createHash } from "node:crypto";
import { ID, Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { repo, type Repo } from "@/lib/data/repo";
import { UserError } from "@/lib/actions";
import { computeInvoice, paymentStatus, SAC_FITNESS } from "@/lib/domain/gst";
import { dayKey, membershipEnd, renewalStart } from "@/lib/domain/membership";
import { istAddDays, istDayNum, istEndOfDay, istStartOfDay, parseIstDate } from "@/lib/domain/ist";
import { withLock } from "@/lib/data/lock";
import { PLAYBOOK_BY_KEY, render, type PlaybookKey } from "@/lib/domain/playbooks";
import { toE164 } from "@/lib/format";
import { deliverMessage } from "@/lib/services/messages";
import { bumpStat } from "@/lib/data/stats";
import type { Automation, Checkin, Gym, Invoice, InvoiceItem, Lead, Member, Membership, Payment, PayMethod, Plan } from "@/lib/types";

const r2 = (n: number) => Math.round(n * 100) / 100;
const TZ = "Asia/Kolkata";

type Actor = { $id: string; name: string };

/* ─────────────────────────── numbering ─────────────────────────── */

async function nextSeq(gymId: string, column: "memberSeq" | "invoiceSeq") {
  const { tables } = adminClient();
  const row = await tables.incrementRowColumn<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, column, value: 1 });
  return row[column];
}

function financialYear(d = new Date()) {
  const y = Number(new Intl.DateTimeFormat("en-IN", { timeZone: TZ, year: "numeric" }).format(d));
  const m = Number(new Intl.DateTimeFormat("en-IN", { timeZone: TZ, month: "numeric" }).format(d));
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

async function nextInvoiceNumber(gymId: string) {
  const seq = await nextSeq(gymId, "invoiceSeq");
  return `INV/${financialYear()}/${String(seq).padStart(4, "0")}`;
}

async function nextMemberCode(gymId: string) {
  const seq = await nextSeq(gymId, "memberSeq");
  return `M${String(seq).padStart(4, "0")}`;
}

/* ─────────────────────────── members ─────────────────────────── */

export type MemberInput = {
  name: string;
  phone: string;
  email?: string;
  gender?: Member["gender"];
  dob?: string;
  lang?: Member["lang"];
  goal?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  notes?: string;
  source?: Member["source"];
  trainerName?: string;
  whatsappOptIn?: boolean;
};

export async function findMemberByPhone(r: Repo, phone: string) {
  const res = await r.list<Member>(T.members, [Query.equal("phone", phone), Query.limit(1)], false);
  return res.rows[0] ?? null;
}

export async function createMember(gym: Gym, input: MemberInput, actor: Actor) {
  const r = repo(gym.$id);
  const phone = toE164(input.phone);
  if (!phone) throw new UserError("Enter a valid 10-digit mobile number.");
  const dupe = await findMemberByPhone(r, phone);
  if (dupe) throw new UserError(`${dupe.name} (${dupe.code}) already uses this number.`);
  const code = await nextMemberCode(gym.$id);
  const member = await r.create<Member>(T.members, {
    code,
    name: input.name.trim(),
    phone,
    email: input.email?.trim().toLowerCase() || null,
    gender: input.gender ?? "unspecified",
    dob: input.dob ? new Date(input.dob).toISOString() : null,
    lang: input.lang ?? "en",
    goal: input.goal || null,
    address: input.address || null,
    emergencyName: input.emergencyName || null,
    emergencyPhone: input.emergencyPhone ? (toE164(input.emergencyPhone) ?? input.emergencyPhone) : null,
    notes: input.notes || null,
    source: input.source ?? "walkin",
    trainerName: input.trainerName || null,
    whatsappOptIn: input.whatsappOptIn ?? true,
    consentAt: new Date().toISOString(),
    status: "none",
    balanceDue: 0,
    visitCount: 0,
  });
  void actor;
  await bumpStat(gym.$id, { newMembers: 1 });
  return member;
}

export async function updateMember(gymId: string, id: string, patch: Partial<MemberInput>) {
  const r = repo(gymId);
  const data: Record<string, unknown> = { ...patch };
  if (patch.phone !== undefined) {
    const phone = toE164(patch.phone);
    if (!phone) throw new UserError("Enter a valid 10-digit mobile number.");
    const dupe = await findMemberByPhone(r, phone);
    if (dupe && dupe.$id !== id) throw new UserError(`${dupe.name} already uses this number.`);
    data.phone = phone;
  }
  if (patch.email !== undefined) data.email = patch.email?.trim().toLowerCase() || null;
  if (patch.dob !== undefined) data.dob = patch.dob ? new Date(patch.dob).toISOString() : null;
  for (const k of ["goal", "address", "emergencyName", "notes", "trainerName"] as const) if (k in patch) data[k] = patch[k] || null;
  return r.update<Member>(T.members, id, data);
}

/* ─────────────────────────── selling memberships ─────────────────────────── */

export type SaleInput = {
  memberId: string;
  planId: string;
  startAt?: string;
  discount?: number;
  includeJoiningFee?: boolean;
  payment?: { amount: number; method: PayMethod; reference?: string } | null;
  /** client-generated key; retries with the same key never double-bill */
  idempotencyKey?: string;
};

const keyId = (prefix: string, ...parts: string[]) => `${prefix}${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 30)}`;

export async function sellMembership(gym: Gym, input: SaleInput, actor: Actor) {
  return withLock(`member:${gym.$id}:${input.memberId}`, () => sellMembershipLocked(gym, input, actor));
}

async function sellMembershipLocked(gym: Gym, input: SaleInput, actor: Actor) {
  const r = repo(gym.$id);
  const membershipId = input.idempotencyKey ? keyId("ms", gym.$id, input.idempotencyKey) : ID.unique();
  if (input.idempotencyKey) {
    const done = await r.find<Membership>(T.memberships, membershipId);
    if (done) {
      const [member, invoice] = await Promise.all([
        r.get<Member>(T.members, done.memberId),
        done.invoiceId ? r.get<Invoice>(T.invoices, done.invoiceId) : Promise.resolve(null),
      ]);
      if (!invoice) throw new UserError("That sale is still being recorded. Refresh in a moment.");
      return { member, membership: done, invoice, payment: null as Payment | null };
    }
  }
  const [member, plan] = await Promise.all([r.get<Member>(T.members, input.memberId), r.get<Plan>(T.plans, input.planId)]);
  if (!plan.active) throw new UserError("This plan is archived.");
  if (member.status === "cancelled") throw new UserError("Restore this member before selling a plan.");

  const now = new Date();
  const start = input.startAt ? istStartOfDay(parseIstDate(input.startAt)) : renewalStart(member.status === "frozen" ? null : member.expiresAt, now);
  const end = membershipEnd(start, plan.durationDays);
  const firstTime = !member.membershipId;

  const items: InvoiceItem[] = [
    { description: `${plan.name} membership (${fmtRange(start, end)})`, qty: 1, rate: plan.price, amount: plan.price, sac: SAC_FITNESS },
  ];
  if (plan.joiningFee > 0 && (input.includeJoiningFee ?? firstTime)) {
    items.push({ description: "Joining fee", qty: 1, rate: plan.joiningFee, amount: plan.joiningFee, sac: SAC_FITNESS });
  }
  const totals = computeInvoice({ items, discount: input.discount ?? 0, rate: gym.gstRate ?? 5, inclusive: gym.gstInclusive ?? true });
  const paidNow = Math.min(r2(input.payment?.amount ?? 0), totals.total);

  const membership = await r.create<Membership>(
    T.memberships,
    {
      memberId: member.$id,
      planId: plan.$id,
      planName: plan.name,
      type: plan.type,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      price: plan.price,
      discount: totals.discount,
      status: start > now ? "upcoming" : "active",
      sessionsTotal: plan.type === "duration" ? 0 : plan.sessions,
      sessionsUsed: 0,
      soldBy: actor.name,
    },
    membershipId,
  );

  const number = await nextInvoiceNumber(gym.$id);
  const invoice = await r.create<Invoice>(T.invoices, {
    memberId: member.$id,
    memberName: member.name,
    memberPhone: member.phone,
    membershipId: membership.$id,
    number,
    issuedAt: new Date().toISOString(),
    items: JSON.stringify(items),
    ...totals,
    paid: paidNow,
    balance: r2(totals.total - paidNow),
    status: paymentStatus(totals.total, paidNow),
  });
  await r.update(T.memberships, membership.$id, { invoiceId: invoice.$id });

  let payment: Payment | null = null;
  if (paidNow > 0 && input.payment) {
    payment = await r.create<Payment>(T.payments, {
      memberId: member.$id,
      memberName: member.name,
      invoiceId: invoice.$id,
      invoiceNumber: number,
      amount: paidNow,
      method: input.payment.method,
      reference: input.payment.reference || null,
      paidAt: new Date().toISOString(),
      recordedBy: actor.$id,
      recordedByName: actor.name,
    });
  }

  // Denormalise "current plan" on the member. A future-dated renewal keeps the current plan visible
  // but extends expiry so reminders and access follow the latest paid-up date. PT packs sold on top of
  // an active gym membership are add-ons and don't replace the main plan.
  const hasActiveMain = !!member.expiresAt && new Date(member.expiresAt) >= now;
  const isAddOn = plan.type === "pt" && hasActiveMain;
  const newExpiry = isAddOn ? new Date(member.expiresAt!) : !member.expiresAt || new Date(member.expiresAt) < end ? end : new Date(member.expiresAt);
  const updated = await r.update<Member>(T.members, member.$id, {
    ...(isAddOn
      ? {}
      : {
          planId: plan.$id,
          planName: plan.name,
          membershipId: membership.$id,
          // keep the original start while the current plan is still running; otherwise this sale starts a new period
          startAt: hasActiveMain && member.startAt && new Date(member.startAt) <= now ? member.startAt : start.toISOString(),
          expiresAt: newExpiry.toISOString(),
          status: "active",
        }),
    balanceDue: r2((member.balanceDue ?? 0) + (totals.total - paidNow)),
  });

  await bumpStat(gym.$id, { sales: 1, ...(payment ? { revenue: payment.amount, payments: 1 } : {}) });
  if (firstTime) await queueEventMessage(gym, "welcome", updated, { plan: plan.name, expiry: fmtDay(newExpiry) });
  if (payment)
    await queueEventMessage(gym, "payment_receipt", updated, { amount: inr(payment.amount), invoice: number, expiry: fmtDay(newExpiry) }, payment.$id);

  return { member: updated, membership, invoice, payment };
}

/* ─────────────────────────── payments ─────────────────────────── */

/**
 * Records a payment and allocates it to the member's open invoices, oldest
 * first. Each invoice allocation is its own payment row (so every invoice
 * shows exactly what settled it). Serialised per member and idempotent.
 */
export async function recordPayment(
  gym: Gym,
  input: { memberId: string; amount: number; method: PayMethod; reference?: string; invoiceId?: string; note?: string; idempotencyKey?: string },
  actor: Actor,
) {
  return withLock(`member:${gym.$id}:${input.memberId}`, async () => {
    const r = repo(gym.$id);
    const baseId = input.idempotencyKey ? keyId("py", gym.$id, input.idempotencyKey) : null;
    if (baseId) {
      const done = await r.find<Payment>(T.payments, `${baseId}0`);
      if (done) return { payment: done, member: await r.get<Member>(T.members, done.memberId) };
    }
    const member = await r.get<Member>(T.members, input.memberId);
    const amount = r2(input.amount);
    if (!(amount > 0)) throw new UserError("Enter an amount greater than zero.");

    let open: Invoice[];
    if (input.invoiceId) {
      const inv = await r.get<Invoice>(T.invoices, input.invoiceId);
      if (inv.memberId !== member.$id) throw new UserError("That invoice belongs to a different member.");
      if (inv.status === "void" || inv.balance <= 0) throw new UserError("That invoice has nothing due.");
      open = [inv];
    } else {
      open = (
        await r.list<Invoice>(
          T.invoices,
          [Query.equal("memberId", member.$id), Query.equal("status", ["unpaid", "partial"]), Query.orderAsc("issuedAt"), Query.limit(50)],
          false,
        )
      ).rows;
    }
    const outstanding = r2(open.reduce((s, i) => s + i.balance, 0));
    if (outstanding <= 0) throw new UserError("Nothing is due for this member. Sell or renew a plan instead.");
    if (amount - outstanding > 0.005) throw new UserError(`Only ${inr(outstanding)} is due. Enter up to that amount.`);

    let left = amount;
    const rows: Payment[] = [];
    const paidAt = new Date().toISOString();
    for (const [i, inv] of open.entries()) {
      if (left <= 0) break;
      const take = r2(Math.min(left, inv.balance));
      const paid = r2(inv.paid + take);
      // payment row first: if a retry happens it finds this row and stops
      rows.push(
        await r.create<Payment>(
          T.payments,
          {
            memberId: member.$id,
            memberName: member.name,
            invoiceId: inv.$id,
            invoiceNumber: inv.number,
            amount: take,
            method: input.method,
            reference: input.reference || null,
            note: input.note || null,
            paidAt,
            recordedBy: actor.$id,
            recordedByName: actor.name,
          },
          baseId ? `${baseId}${i}` : ID.unique(),
        ),
      );
      await r.update<Invoice>(T.invoices, inv.$id, { paid, balance: r2(inv.total - paid), status: paymentStatus(inv.total, paid) });
      left = r2(left - take);
    }

    const fresh = await r.get<Member>(T.members, member.$id);
    const updated = await r.update<Member>(T.members, member.$id, { balanceDue: Math.max(0, r2(fresh.balanceDue - amount)) });
    await bumpStat(gym.$id, { revenue: amount, payments: 1 });
    const numbers = rows.map((p) => p.invoiceNumber).join(", ");
    await queueEventMessage(
      gym,
      "payment_receipt",
      updated,
      { amount: inr(amount), invoice: numbers, expiry: updated.expiresAt ? fmtDay(new Date(updated.expiresAt)) : "" },
      rows[0].$id,
    );
    return { payment: rows[0], member: updated };
  });
}

export async function voidInvoice(gymId: string, invoiceId: string) {
  const inv0 = await repo(gymId).get<Invoice>(T.invoices, invoiceId);
  return withLock(`member:${gymId}:${inv0.memberId}`, () => voidInvoiceLocked(gymId, invoiceId));
}

async function voidInvoiceLocked(gymId: string, invoiceId: string) {
  const r = repo(gymId);
  const inv = await r.get<Invoice>(T.invoices, invoiceId);
  if (inv.status === "void") return inv;
  if (inv.paid > 0) throw new UserError("This invoice has payments. Refund them first, then void.");
  const updated = await r.update<Invoice>(T.invoices, invoiceId, { status: "void", balance: 0 });
  const member = await r.get<Member>(T.members, inv.memberId);
  await r.update(T.members, member.$id, { balanceDue: Math.max(0, r2(member.balanceDue - inv.balance)) });
  if (inv.membershipId) {
    const ms = await r.find<Membership>(T.memberships, inv.membershipId);
    if (ms && ms.status !== "completed") {
      await r.update(T.memberships, ms.$id, { status: "cancelled" });
      if (member.membershipId === ms.$id) await recomputeMemberPlan(gymId, member.$id);
    }
  }
  return updated;
}

/** Re-derives the member's current plan + expiry from their non-cancelled memberships. */
export async function recomputeMemberPlan(gymId: string, memberId: string) {
  const r = repo(gymId);
  const list = (
    await r.list<Membership>(
      T.memberships,
      [Query.equal("memberId", memberId), Query.notEqual("status", "cancelled"), Query.orderDesc("endAt"), Query.limit(1)],
      false,
    )
  ).rows;
  const latest = list[0];
  await r.update(
    T.members,
    memberId,
    latest
      ? {
          planId: latest.planId,
          planName: latest.planName,
          membershipId: latest.$id,
          expiresAt: latest.endAt,
          status: latest.status === "frozen" ? "frozen" : "active",
        }
      : { planId: null, planName: null, membershipId: null, expiresAt: null, status: "none" },
  );
}

/* ─────────────────────────── freeze ─────────────────────────── */

export async function freezeMember(gymId: string, memberId: string, days: number, reason?: string) {
  return withLock(`member:${gymId}:${memberId}`, () => freezeMemberLocked(gymId, memberId, days, reason));
}

async function freezeMemberLocked(gymId: string, memberId: string, days: number, reason?: string) {
  if (!(days >= 1 && days <= 180)) throw new UserError("Freeze for 1–180 days.");
  const r = repo(gymId);
  const member = await r.get<Member>(T.members, memberId);
  if (member.status === "frozen") throw new UserError("Already frozen.");
  if (!member.membershipId || !member.expiresAt || new Date(member.expiresAt) < new Date()) throw new UserError("Only active memberships can be frozen.");
  const from = istStartOfDay();
  const until = istEndOfDay(istAddDays(from, days - 1));
  const ms = await r.get<Membership>(T.memberships, member.membershipId);
  const newEnd = istAddDays(ms.endAt, days);
  await r.update(T.memberships, ms.$id, {
    status: "frozen",
    freezeFrom: from.toISOString(),
    freezeUntil: until.toISOString(),
    frozenDays: (ms.frozenDays ?? 0) + days,
    endAt: newEnd.toISOString(),
  });
  return r.update<Member>(T.members, memberId, {
    status: "frozen",
    expiresAt: istAddDays(member.expiresAt, days).toISOString(),
    notes: reason ? `${member.notes ? `${member.notes}\n` : ""}[${dayKey()}] Frozen ${days}d: ${reason}` : member.notes,
  });
}

export async function unfreezeMember(gymId: string, memberId: string) {
  return withLock(`member:${gymId}:${memberId}`, () => unfreezeMemberLocked(gymId, memberId));
}

async function unfreezeMemberLocked(gymId: string, memberId: string) {
  const r = repo(gymId);
  const member = await r.get<Member>(T.members, memberId);
  if (member.status !== "frozen" || !member.membershipId) throw new UserError("This member isn't frozen.");
  const ms = await r.get<Membership>(T.memberships, member.membershipId);
  // unused = frozen IST days from today through the last frozen day, inclusive
  const unused = ms.freezeUntil ? Math.max(0, istDayNum(ms.freezeUntil) - istDayNum() + 1) : 0;
  const endAt = istAddDays(ms.endAt, -unused);
  await r.update(T.memberships, ms.$id, {
    status: "active",
    freezeUntil: new Date().toISOString(),
    frozenDays: Math.max(0, (ms.frozenDays ?? 0) - unused),
    endAt: endAt.toISOString(),
  });
  return r.update<Member>(T.members, memberId, { status: "active", expiresAt: istAddDays(member.expiresAt!, -unused).toISOString() });
}

/* ─────────────────────────── check-ins ─────────────────────────── */

export async function checkIn(gym: Gym, memberId: string, method: Checkin["method"], actor: Actor) {
  const r = repo(gym.$id);
  const member = await r.get<Member>(T.members, memberId);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await r.list<Checkin>(T.checkins, [Query.equal("memberId", memberId), Query.greaterThan("at", since), Query.limit(1)], false);
  if (recent.rows[0]) return { member, checkin: recent.rows[0], duplicate: true };

  const now = new Date();
  const checkin = await r.create<Checkin>(T.checkins, {
    memberId,
    memberName: member.name,
    at: now.toISOString(),
    dayKey: dayKey(now),
    method,
    by: actor.name,
  });
  const { tables } = adminClient();
  await tables.incrementRowColumn({ databaseId: DB_ID, tableId: T.members, rowId: memberId, column: "visitCount", value: 1 });
  const updated = await r.update<Member>(T.members, memberId, { lastVisitAt: now.toISOString() });
  await bumpStat(gym.$id, { checkins: 1 }, now);

  // session-based plans consume a session per visit
  if (member.membershipId) {
    const ms = await r.find<Membership>(T.memberships, member.membershipId);
    if (ms && ms.type !== "duration" && ms.sessionsTotal > 0 && ms.sessionsUsed < ms.sessionsTotal) {
      await tables.incrementRowColumn({ databaseId: DB_ID, tableId: T.memberships, rowId: ms.$id, column: "sessionsUsed", value: 1, max: ms.sessionsTotal });
    }
  }
  return { member: updated, checkin, duplicate: false };
}

/* ─────────────────────────── leads ─────────────────────────── */

export async function convertLead(gym: Gym, leadId: string, actor: Actor) {
  const r = repo(gym.$id);
  const lead = await r.get<Lead>(T.leads, leadId);
  if (lead.memberId) return { member: await r.get<Member>(T.members, lead.memberId), lead };
  const existing = await findMemberByPhone(r, lead.phone);
  const member =
    existing ??
    (await createMember(gym, { name: lead.name, phone: lead.phone, email: lead.email ?? undefined, goal: lead.goal ?? undefined, source: lead.source }, actor));
  const updated = await r.update<Lead>(T.leads, leadId, { status: "joined", memberId: member.$id });
  return { member, lead: updated };
}

/* ─────────────────────────── messaging helpers ─────────────────────────── */

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(d);
const fmtRange = (a: Date, b: Date) => `${fmtDay(a)} – ${fmtDay(b)}`;

/** Queue (and auto-send if enabled) an event-driven playbook message. */
export async function queueEventMessage(gym: Gym, key: PlaybookKey, member: Member, vars: Record<string, string>, eventId?: string) {
  try {
    if (!member.whatsappOptIn || !member.phone) return;
    const r = repo(gym.$id);
    const auto = (await r.list<Automation>(T.automations, [Query.equal("key", key), Query.limit(1)], false)).rows[0];
    if (!auto?.enabled) return;
    const def = PLAYBOOK_BY_KEY[key];
    const tpl = (member.lang === "te" ? auto.templateTe || def.te : auto.templateEn || def.en) || def.en;
    const body = render(tpl, { name: member.name.split(" ")[0], gym: gym.name, ...vars });
    const msg = await r
      .create(T.messages, {
        memberId: member.$id,
        name: member.name,
        phone: member.phone,
        playbook: key,
        channel: auto.channel ?? "whatsapp",
        body,
        status: "queued",
        dueAt: new Date().toISOString(),
        dedupeKey: `${key}:${member.$id}:${eventId ?? Date.now()}`.slice(0, 64),
      })
      .catch(() => null);
    if (msg && gym.messagingEnabled && gym.autoSend) await deliverMessage(gym, msg.$id).catch((e) => console.error("[deliver]", e));
  } catch (e) {
    console.error("[queueEventMessage]", e);
  }
}

/** Resume memberships whose freeze window has ended (run by the scheduler). */
export async function autoUnfreeze(gymId: string) {
  const r = repo(gymId);
  const due = await r.list<Membership>(
    T.memberships,
    [Query.equal("status", "frozen"), Query.lessThan("freezeUntil", new Date().toISOString()), Query.limit(200)],
    false,
  );
  for (const ms of due.rows) {
    await r.update(T.memberships, ms.$id, { status: "active" });
    const m = await r.find<Member>(T.members, ms.memberId);
    if (m?.status === "frozen" && m.membershipId === ms.$id) await r.update(T.members, m.$id, { status: "active" });
  }
  return due.rows.length;
}
