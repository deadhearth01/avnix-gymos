"use server";

import { revalidatePath } from "next/cache";
import { requireCap } from "@/lib/auth/session";
import { safe } from "@/lib/actions";
import { checkIn } from "@/lib/services/gym";
import { searchPeople } from "@/lib/queries/gym";
import { CAN_ENTER, liveStatus } from "@/lib/domain/membership";
import { repo } from "@/lib/data/repo";
import { audit } from "@/lib/data/audit";
import { T } from "@/lib/appwrite/schema";
import { Query } from "node-appwrite";
import type { Checkin, Member } from "@/lib/types";

export type DeskMember = {
  id: string;
  name: string;
  code: string | null;
  phone: string;
  planName: string | null;
  expiresAt: string | null;
  balanceDue: number;
  status: ReturnType<typeof liveStatus>;
  lastVisitAt: string | null;
  visitCount: number;
};

export async function deskSearchAction(q: string): Promise<DeskMember[]> {
  const ctx = await requireCap("checkins.create");
  const t = q.trim();
  if (!t || (t.length < 2 && !/^\d$/.test(t))) return [];
  const people = await searchPeople(ctx.gymId, q);
  return people.map((m) => ({
    id: m.$id,
    name: m.name,
    code: m.code,
    phone: m.phone,
    planName: m.planName,
    expiresAt: m.expiresAt,
    balanceDue: m.balanceDue,
    status: liveStatus(m),
    lastVisitAt: m.lastVisitAt,
    visitCount: m.visitCount,
  }));
}

export async function checkInAction(memberId: string, method: "manual" | "qr" | "kiosk" = "manual", override = false) {
  return safe(async () => {
    const ctx = await requireCap("checkins.create");
    const member = await repo(ctx.gymId).get<Member>(T.members, memberId);
    const status = liveStatus(member);
    // Access policy: no valid plan → don't record a visit unless staff explicitly lets them in once.
    if (!CAN_ENTER.includes(status) && !override) {
      return {
        blocked: true,
        duplicate: false,
        name: member.name,
        status,
        balanceDue: member.balanceDue,
        expiresAt: member.expiresAt,
        visitCount: member.visitCount,
      };
    }
    const r = await checkIn(ctx.gym, memberId, method, { $id: ctx.user.$id, name: ctx.user.name || ctx.user.email });
    if (override)
      await audit({
        gymId: ctx.gymId,
        actor: ctx.user,
        action: "checkin.override",
        entity: "member",
        entityId: memberId,
        summary: `${member.name} let in without a valid plan (${status})`,
      });
    revalidatePath("/front-desk");
    return {
      blocked: false,
      duplicate: r.duplicate,
      name: r.member.name,
      status: liveStatus(r.member),
      balanceDue: r.member.balanceDue,
      expiresAt: r.member.expiresAt,
      visitCount: r.member.visitCount + (r.duplicate ? 0 : 1),
    };
  });
}

export type DeskCheckin = { id: string; memberId: string; name: string; at: string; method: string; by: string | null };

const toDesk = (c: Checkin): DeskCheckin => ({ id: c.$id, memberId: c.memberId, name: c.memberName, at: c.at, method: c.method, by: c.by });

/** Check-ins for one IST day (the front desk's day picker). */
export async function deskDayAction(day: string): Promise<{ items: DeskCheckin[]; total: number }> {
  const ctx = await requireCap("checkins.create");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { items: [], total: 0 };
  const r = await repo(ctx.gymId).list<Checkin>(T.checkins, [Query.equal("dayKey", day), Query.orderDesc("at"), Query.limit(300)], true);
  return { items: r.rows.map(toDesk), total: r.total };
}

/** Everything the desk shows when you click a check-in: how they came in, their plan, recent visits. */
export async function checkinDetailAction(checkinId: string) {
  const ctx = await requireCap("checkins.create");
  const r = repo(ctx.gymId);
  const checkin = await r.find<Checkin>(T.checkins, checkinId);
  if (!checkin) return null;
  const [member, recent] = await Promise.all([
    r.find<Member>(T.members, checkin.memberId),
    r.list<Checkin>(T.checkins, [Query.equal("memberId", checkin.memberId), Query.orderDesc("at"), Query.limit(6)], false),
  ]);
  return {
    checkin: toDesk(checkin),
    member: member
      ? {
          id: member.$id,
          name: member.name,
          code: member.code,
          planName: member.planName,
          expiresAt: member.expiresAt,
          status: liveStatus(member),
          balanceDue: member.balanceDue,
          visitCount: member.visitCount,
        }
      : null,
    recent: recent.rows.filter((c) => c.$id !== checkin.$id).map(toDesk),
  };
}

export type LogFilter = { from: string; to: string; q?: string; method?: string };

/**
 * Attendance log for a date range (IST days, inclusive, up to 92 days): every check-in with time,
 * mode and who recorded it. Optional person filter (name or member number) and mode filter.
 */
export async function attendanceLogAction(f: LogFilter): Promise<{ rows: DeskCheckin[]; capped: boolean } | { error: string }> {
  const ctx = await requireCap("checkins.create");
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(f.from) || !ymd.test(f.to) || f.from > f.to) return { error: "Pick a valid date range." };
  const days = (Date.parse(f.to) - Date.parse(f.from)) / 86_400_000;
  if (days > 92) return { error: "Pick a range of 3 months or less." };
  const r = repo(ctx.gymId);
  const queries = [Query.greaterThanEqual("dayKey", f.from), Query.lessThanEqual("dayKey", f.to), Query.orderDesc("at")];
  const methods = ["manual", "qr", "face", "fingerprint", "card", "kiosk", "biometric"];
  if (f.method && methods.includes(f.method)) queries.push(Query.equal("method", f.method === "fingerprint" ? ["fingerprint", "biometric"] : [f.method]));
  const q = f.q?.trim().slice(0, 64);
  if (q) {
    const people = await searchPeople(ctx.gymId, q);
    if (!people.length) return { rows: [], capped: false };
    queries.push(
      Query.equal(
        "memberId",
        people.map((p) => p.$id),
      ),
    );
  }
  const CAP = 5000;
  const rows = await r.all<Checkin>(T.checkins, queries, CAP);
  return { rows: rows.map(toDesk), capped: rows.length >= CAP };
}
