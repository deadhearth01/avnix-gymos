import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listLeads } from "@/lib/queries/gym";
import { PageHeader } from "@/components/kit/page-header";
import { LiveRefresh } from "@/components/realtime/realtime-provider";
import { LeadsBoard } from "./leads-board";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const ctx = await requireCap("leads.view");
  const sp = await searchParams;
  const leads = await listLeads(ctx.gymId);
  return (
    <>
      <LiveRefresh tables={["leads"]} />
      <PageHeader
        title="Leads"
        description="Every enquiry from your website, WhatsApp and walk-ins — from first hello to member."
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Leads" }]}
      />
      <LeadsBoard
        gymName={ctx.gym.name}
        canEdit={can(ctx.role, "leads.edit")}
        canConvert={can(ctx.role, "members.edit")}
        openNew={sp.new === "1"}
        leads={leads.map((l) => ({
          id: l.$id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          source: l.source,
          goal: l.goal,
          status: l.status,
          trialAt: l.trialAt,
          followUpAt: l.followUpAt,
          notes: l.notes,
          lostReason: l.lostReason,
          memberId: l.memberId,
          createdAt: l.$createdAt,
          assignedName: l.assignedName,
        }))}
      />
    </>
  );
}
