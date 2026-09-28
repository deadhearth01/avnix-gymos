import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Models } from "node-appwrite";
import { adminClient, sessionClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { superAdminEmails } from "@/lib/env";
import { can, highestRole, type Capability } from "@/lib/auth/rbac";
import { GYM_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Gym, StaffRole } from "@/lib/types";

export type SessionUser = Models.User<Models.Preferences>;

export const getSession = cache(async (): Promise<{ user: SessionUser; secret: string } | null> => {
  const secret = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!secret) return null;
  try {
    const ua = (await headers()).get("user-agent") ?? undefined;
    const user = await sessionClient(secret, ua).account.get();
    if (!user.status) return null; // blocked account
    return { user, secret };
  } catch {
    return null;
  }
});

export function isSuperAdmin(user: SessionUser | null | undefined) {
  if (!user) return false;
  return user.labels?.includes("superadmin") && superAdminEmails().includes(user.email.toLowerCase());
}

export async function requireUser() {
  const s = await getSession();
  // Stale/invalid cookie → clear it via route handler (cookies can't be deleted during render)
  if (!s) redirect((await cookies()).get(SESSION_COOKIE) ? "/auth/signout?reason=expired" : "/login");
  return s;
}

export const requireSuperAdmin = cache(async () => {
  const s = await requireUser();
  if (!isSuperAdmin(s.user)) redirect("/dashboard");
  return s;
});

export type GymContext = {
  user: SessionUser;
  gym: Gym;
  gymId: string;
  role: StaffRole;
  superAdmin: boolean;
  /** true when a super-admin is viewing a gym they are not a member of */
  impersonating: boolean;
  memberships: { gymId: string; role: StaffRole }[];
};

export const getGymContext = cache(async (): Promise<GymContext> => {
  const { user } = await requireUser();
  const superAdmin = isSuperAdmin(user);
  const { users, tables } = adminClient();
  const { memberships } = await users.listMemberships({ userId: user.$id });
  const mine = memberships
    .filter((m) => m.confirm)
    .map((m) => ({ gymId: m.teamId, role: highestRole(m.roles) }))
    .filter((m): m is { gymId: string; role: StaffRole } => !!m.role);

  const preferred = (await cookies()).get(GYM_COOKIE)?.value;
  let pick = mine.find((m) => m.gymId === preferred) ?? mine[0];
  let impersonating = false;
  if (superAdmin && preferred && !mine.some((m) => m.gymId === preferred)) {
    pick = { gymId: preferred, role: "owner" };
    impersonating = true;
  }
  if (!pick) redirect(superAdmin ? "/admin" : "/no-access");

  let gym: Gym;
  try {
    gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: pick.gymId });
  } catch {
    redirect(superAdmin ? "/admin" : "/no-access");
  }
  if (gym.status !== "active" && !superAdmin) redirect("/paused");

  return { user, gym, gymId: gym.$id, role: pick.role, superAdmin, impersonating, memberships: mine };
});

/** Use at the top of every server action / page that needs a capability. */
export async function requireCap(cap: Capability) {
  const ctx = await getGymContext();
  if (!can(ctx.role, cap)) throw new ForbiddenError(cap);
  return ctx;
}

export class ForbiddenError extends Error {
  constructor(cap: string) {
    super(`You don't have permission to do that (${cap}).`);
    this.name = "ForbiddenError";
  }
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim().slice(0, 45);
}
