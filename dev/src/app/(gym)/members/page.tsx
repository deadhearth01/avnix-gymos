import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listMembers, listPlans } from "@/lib/queries/gym";
import { toMemberRows } from "./rows";
import { PageHeader } from "@/components/kit/page-header";
import { LiveRefresh } from "@/components/realtime/realtime-provider";
import { MembersView } from "./members-view";

export const metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const ctx = await requireCap("members.view");
  const sp = await searchParams;
  const [members, plans] = await Promise.all([listMembers(ctx.gymId), listPlans(ctx.gymId)]);
  return (
    <>
      <LiveRefresh tables={["members"]} />
      <PageHeader
        title="Members"
        description="Everyone who trains with you — plans, dues and attendance at a glance."
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Members" }]}
      />
      <MembersView
        gymName={ctx.gym.name}
        gst={{ rate: ctx.gym.gstRate ?? 5, inclusive: ctx.gym.gstInclusive ?? true }}
        canEdit={can(ctx.role, "members.edit")}
        canBill={can(ctx.role, "billing.collect")}
        openNew={sp.new === "1"}
        initialStatus={typeof sp.status === "string" ? sp.status : undefined}
        plans={plans.map((p) => ({
          id: p.$id,
          name: p.name,
          type: p.type,
          durationDays: p.durationDays,
          sessions: p.sessions,
          price: p.price,
          joiningFee: p.joiningFee,
          color: p.color,
        }))}
        members={toMemberRows(members)}
      />
    </>
  );
}
