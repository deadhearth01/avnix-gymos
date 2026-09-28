import { requireCap } from "@/lib/auth/session";
import { adminClient } from "@/lib/appwrite/server";
import { Query } from "node-appwrite";
import { CAPABILITIES, ROLE_LABEL } from "@/lib/auth/rbac";
import { StaffView } from "./staff-view";
import type { StaffRole } from "@/lib/types";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const ctx = await requireCap("staff.manage");
  const memberships: Awaited<ReturnType<ReturnType<typeof adminClient>["teams"]["listMemberships"]>>["memberships"] = [];
  let cursor: string | undefined;
  do {
    const result = await adminClient().teams.listMemberships({
      teamId: ctx.gymId,
      queries: [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    memberships.push(...result.memberships);
    cursor = result.memberships.length === 100 ? result.memberships.at(-1)?.$id : undefined;
  } while (cursor);
  const staff = memberships.map((m) => ({
    id: m.$id,
    userId: m.userId,
    name: m.userName,
    email: m.userEmail,
    role: (m.roles.find((r) => r in ROLE_LABEL) ?? "trainer") as StaffRole,
    joined: m.joined,
    confirmed: m.confirm,
  }));
  const permissions = Object.entries(CAPABILITIES).map(([cap, roles]) => ({ cap, roles: [...roles] as StaffRole[] }));
  return <StaffView staff={staff} permissions={permissions} gymId={ctx.gymId} gymName={ctx.gym.name} currentUserId={ctx.user.$id} />;
}
