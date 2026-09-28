import { liveStatus } from "@/lib/domain/membership";
import type { Member } from "@/lib/types";
import type { MemberRow } from "./members-view";

/** Server-side projection of members for the table (time-relative flags computed once). */
export function toMemberRows(members: Member[], now = Date.now()): MemberRow[] {
  return members.map((m) => {
    const status = liveStatus(m);
    return {
      id: m.$id,
      code: m.code,
      name: m.name,
      phone: m.phone,
      email: m.email,
      planName: m.planName,
      expiresAt: m.expiresAt,
      lastVisitAt: m.lastVisitAt,
      visitCount: m.visitCount,
      balanceDue: m.balanceDue,
      status,
      idle: !!m.lastVisitAt && now - new Date(m.lastVisitAt).getTime() > 7 * 86400e3 && status !== "expired" && status !== "none",
      isNew: now - new Date(m.$createdAt).getTime() < 30 * 86400e3,
      gender: m.gender,
      lang: m.lang,
      source: m.source,
      createdAt: m.$createdAt,
    };
  });
}
