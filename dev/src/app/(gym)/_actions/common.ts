"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getGymContext, requireCap } from "@/lib/auth/session";
import { GYM_COOKIE } from "@/lib/auth/cookies";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID } from "@/lib/appwrite/schema";
import { env } from "@/lib/env";
import { searchPeople } from "@/lib/queries/gym";
import { fmtPhone } from "@/lib/format";

export async function switchGymAction(gymId: string) {
  const ctx = await getGymContext();
  if (!ctx.memberships.some((m) => m.gymId === gymId) && !ctx.superAdmin) return;
  (await cookies()).set(GYM_COOKIE, gymId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function exitImpersonationAction() {
  (await cookies()).delete(GYM_COOKIE);
  redirect("/admin/gyms");
}

export async function searchAction(q: string) {
  const ctx = await requireCap("members.view");
  const people = await searchPeople(ctx.gymId, q);
  return people.map((m) => ({ id: m.$id, title: m.name, subtitle: `${m.code ?? ""} · ${fmtPhone(m.phone)}`, href: `/members/${m.$id}` }));
}

/**
 * Short-lived JWT for Appwrite Realtime. Rows are readable by the gym's team
 * only, so the socket can never receive another gym's events.
 */
export async function realtimeTokenAction() {
  const ctx = await getGymContext();
  if (ctx.impersonating) return null; // super-admins aren't team members; they use manual refresh
  const { users } = adminClient();
  const jwt = await users.createJWT({ userId: ctx.user.$id, duration: 900 });
  const e = env();
  return {
    jwt: jwt.jwt,
    endpoint: e.APPWRITE_ENDPOINT,
    project: e.APPWRITE_PROJECT_ID,
    db: DB_ID,
    gymId: ctx.gymId,
  };
}

/** Remember which guided tours this user has finished (merged into their Appwrite prefs). */
export async function markTourSeenAction(key: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(key)) return;
  const ctx = await getGymContext();
  if (ctx.impersonating) return;
  const { users } = adminClient();
  const prefs = (await users.getPrefs({ userId: ctx.user.$id })) as Record<string, unknown>;
  const seen = Array.isArray(prefs.tours) ? (prefs.tours as unknown[]).filter((t): t is string => typeof t === "string") : [];
  if (seen.includes(key)) return;
  await users.updatePrefs({ userId: ctx.user.$id, prefs: { ...prefs, tours: [...seen, key].slice(-40) } });
}
