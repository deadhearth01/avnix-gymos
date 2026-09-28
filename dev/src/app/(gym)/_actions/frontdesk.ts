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
import type { Member } from "@/lib/types";

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
  if (q.trim().length < 2) return [];
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
