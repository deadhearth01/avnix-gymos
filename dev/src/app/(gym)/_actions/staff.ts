"use server";

import { revalidatePath } from "next/cache";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { safe, UserError } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { adminClient } from "@/lib/appwrite/server";
import { generatePassword } from "@/lib/domain/password";
import { STAFF_ROLES } from "@/lib/appwrite/schema";

const addSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(128),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  role: z.enum(STAFF_ROLES).refine((r) => r !== "owner", "Owners are set up by AvniX"),
});

export async function addStaffAction(payload: z.input<typeof addSchema>) {
  return safe(async () => {
    const ctx = await requireCap("staff.manage");
    const d = addSchema.parse(payload);
    const { users, teams } = adminClient();
    const existing = (await users.list({ queries: [Query.equal("email", d.email), Query.limit(1)] })).users[0];
    let password: string | null = null;
    let userId = existing?.$id;
    if (!existing) {
      password = generatePassword();
      const u = await users.create({ userId: ID.unique(), email: d.email, password, name: d.name });
      userId = u.$id;
      await users.updateEmailVerification({ userId, emailVerification: true });
      await users.updatePrefs({ userId, prefs: { mustChangePassword: true } });
    }
    const current = await teams.listMemberships({ teamId: ctx.gymId, queries: [Query.equal("userId", userId!), Query.limit(1)] });
    if (current.memberships[0]) throw new UserError(`${d.email} is already on your team.`);
    await teams.createMembership({ teamId: ctx.gymId, roles: [d.role], userId });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "staff.add", entity: "user", entityId: userId, summary: `${d.name} <${d.email}> as ${d.role}` });
    revalidatePath("/staff");
    return { email: d.email, password, existing: !!existing };
  }, "Team member added");
}

async function membershipOf(teamId: string, membershipId: string) {
  const { teams } = adminClient();
  const m = await teams.getMembership({ teamId, membershipId });
  return m;
}

export async function updateStaffRoleAction(membershipId: string, role: (typeof STAFF_ROLES)[number]) {
  return safe(async () => {
    const ctx = await requireCap("staff.manage");
    if (role === "owner") throw new UserError("Ownership transfers go through AvniX support.");
    const m = await membershipOf(ctx.gymId, membershipId);
    if (m.roles.includes("owner")) throw new UserError("You can't change the owner's role.");
    await adminClient().teams.updateMembership({ teamId: ctx.gymId, membershipId, roles: [role] });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "staff.role", entity: "user", entityId: m.userId, summary: `${m.userName} → ${role}` });
    revalidatePath("/staff");
  }, "Role updated");
}

export async function removeStaffAction(membershipId: string) {
  return safe(async () => {
    const ctx = await requireCap("staff.manage");
    const m = await membershipOf(ctx.gymId, membershipId);
    if (m.roles.includes("owner")) throw new UserError("The owner can't be removed.");
    if (m.userId === ctx.user.$id) throw new UserError("You can't remove yourself.");
    const { teams, users } = adminClient();
    await teams.deleteMembership({ teamId: ctx.gymId, membershipId });
    // sign them out so they lose access immediately
    await users.deleteSessions({ userId: m.userId }).catch(() => {});
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "staff.remove", entity: "user", entityId: m.userId, summary: m.userName });
    revalidatePath("/staff");
  }, "Removed from team");
}

export async function resetStaffPasswordAction(membershipId: string) {
  return safe(async () => {
    const ctx = await requireCap("staff.manage");
    const m = await membershipOf(ctx.gymId, membershipId);
    if (m.roles.includes("owner") && m.userId !== ctx.user.$id) throw new UserError("Ask AvniX support to reset the owner's password.");
    const { users } = adminClient();
    // Passwords are global Appwrite credentials. Only reset accounts that belong to this gym alone,
    // otherwise an owner could take over someone's access to another gym (or a super-admin).
    const [target, theirs] = await Promise.all([users.get({ userId: m.userId }), users.listMemberships({ userId: m.userId })]);
    if (target.labels?.includes("superadmin")) throw new UserError("This account can't be reset from a gym.");
    if (theirs.memberships.some((x) => x.teamId !== ctx.gymId))
      throw new UserError("This person also works at another gym. Ask them to change their password themselves, or contact AvniX support.");
    const password = generatePassword();
    await users.updatePassword({ userId: m.userId, password });
    await users.updatePrefs({ userId: m.userId, prefs: { mustChangePassword: true } });
    await users.deleteSessions({ userId: m.userId }).catch(() => {});
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "staff.password_reset", entity: "user", entityId: m.userId, summary: m.userEmail });
    return { email: m.userEmail, password };
  });
}
