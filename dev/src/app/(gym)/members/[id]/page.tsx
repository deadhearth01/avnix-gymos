import { notFound } from "next/navigation";
import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { memberProfile, listPlans } from "@/lib/queries/gym";
import { NotFoundError } from "@/lib/data/repo";
import { liveStatus } from "@/lib/domain/membership";
import { LiveRefresh } from "@/components/realtime/realtime-provider";
import { MemberProfile } from "./member-profile";
import { attendanceSummary, planProgress } from "./attendance";
import { daysUntil } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const ctx = await requireCap("members.view");
  const p = await memberProfile(ctx.gymId, id).catch(() => null);
  return { title: p?.member.name ?? "Member" };
}

export default async function MemberPage({ params, searchParams }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCap("members.view");
  const [p, plans] = await Promise.all([
    memberProfile(ctx.gymId, id, { billing: can(ctx.role, "billing.view"), messages: can(ctx.role, "automations.view") }).catch((e) => {
      if (e instanceof NotFoundError) return null;
      throw e;
    }),
    listPlans(ctx.gymId),
  ]);
  if (!p) notFound();
  const m = p.member;
  const current = p.memberships.find((x) => x.$id === m.membershipId) ?? null;
  const ptPacks = p.memberships.filter(
    (x) => x.type !== "duration" && x.status !== "cancelled" && x.sessionsUsed < x.sessionsTotal && new Date(x.endAt) >= new Date(),
  );

  return (
    <>
      <LiveRefresh tables={["checkins", "payments", "invoices", "messages", "members"]} />
      <MemberProfile
        initialAction={typeof sp.action === "string" ? sp.action : undefined}
        gym={{ name: ctx.gym.name, gstRate: ctx.gym.gstRate ?? 5, gstInclusive: ctx.gym.gstInclusive ?? true }}
        perms={{
          edit: can(ctx.role, "members.edit"),
          bill: can(ctx.role, "billing.collect"),
          void: can(ctx.role, "billing.void"),
          archive: can(ctx.role, "members.delete"),
          viewBilling: can(ctx.role, "billing.view"),
          viewMessages: can(ctx.role, "automations.view"),
        }}
        member={{
          id: m.$id,
          code: m.code,
          name: m.name,
          phone: m.phone,
          email: m.email,
          gender: m.gender,
          dob: m.dob,
          lang: m.lang,
          goal: m.goal,
          address: m.address,
          emergencyName: m.emergencyName,
          emergencyPhone: m.emergencyPhone,
          notes: m.notes,
          source: m.source,
          trainerName: m.trainerName,
          whatsappOptIn: m.whatsappOptIn,
          status: liveStatus(m),
          rawStatus: m.status,
          planName: m.planName,
          startAt: m.startAt,
          expiresAt: m.expiresAt,
          balanceDue: m.balanceDue,
          visitCount: m.visitCount,
          lastVisitAt: m.lastVisitAt,
          createdAt: m.$createdAt,
        }}
        current={
          current
            ? {
                planName: current.planName,
                startAt: current.startAt,
                endAt: m.expiresAt ?? current.endAt,
                frozenDays: current.frozenDays,
                freezeUntil: current.freezeUntil,
                status: current.status,
                progress: planProgress(current.startAt, m.expiresAt ?? current.endAt),
              }
            : null
        }
        daysLeft={daysUntil(m.expiresAt)}
        ptPacks={ptPacks.map((x) => ({ id: x.$id, planName: x.planName, used: x.sessionsUsed, total: x.sessionsTotal, endAt: x.endAt }))}
        memberships={p.memberships.map((x) => ({
          id: x.$id,
          planName: x.planName,
          type: x.type,
          startAt: x.startAt,
          endAt: x.endAt,
          status: x.status,
          price: x.price,
          discount: x.discount,
          soldBy: x.soldBy,
        }))}
        invoices={p.invoices.map((i) => ({
          id: i.$id,
          number: i.number,
          issuedAt: i.issuedAt,
          total: i.total,
          paid: i.paid,
          balance: i.balance,
          status: i.status,
        }))}
        payments={p.payments.map((x) => ({
          id: x.$id,
          amount: x.amount,
          method: x.method,
          reference: x.reference,
          paidAt: x.paidAt,
          invoiceNumber: x.invoiceNumber,
          by: x.recordedByName,
        }))}
        messages={p.messages.map((x) => ({
          id: x.$id,
          playbook: x.playbook,
          body: x.body,
          status: x.status,
          channel: x.channel,
          at: x.sentAt ?? x.$createdAt,
        }))}
        attendance={attendanceSummary(p.checkins.map((c) => c.at))}
        plans={plans.map((x) => ({
          id: x.$id,
          name: x.name,
          type: x.type,
          durationDays: x.durationDays,
          sessions: x.sessions,
          price: x.price,
          joiningFee: x.joiningFee,
          color: x.color,
        }))}
      />
    </>
  );
}
