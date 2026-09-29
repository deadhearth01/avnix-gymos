import { notFound } from "next/navigation";
import { gymAdminDetail } from "@/lib/queries/admin";
import { dnsTargets, gymSubdomain } from "@/lib/services/platform";
import { GymDetail } from "./gym-detail";

export async function generateMetadata({ params }: PageProps<"/admin/gyms/[id]">) {
  const { id } = await params;
  const d = await gymAdminDetail(id).catch(() => null);
  return { title: d?.gym.name ?? "Gym" };
}

export default async function GymAdminPage({ params, searchParams }: PageProps<"/admin/gyms/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const d = await gymAdminDetail(id).catch(() => null);
  if (!d) notFound();
  const { gym, sub } = d;
  return (
    <GymDetail
      initialTab={typeof sp.tab === "string" ? sp.tab : "overview"}
      dns={dnsTargets()}
      subdomain={gymSubdomain(gym.slug)}
      gym={{
        id: gym.$id,
        logoFileId: gym.logoFileId,
        name: gym.name,
        slug: gym.slug,
        city: gym.city,
        address: gym.address,
        phone: gym.phone,
        gstin: gym.gstin,
        brandColor: gym.brandColor,
        status: gym.status,
        ownerName: gym.ownerName,
        ownerEmail: gym.ownerEmail,
        ownerPhone: gym.ownerPhone,
        createdAt: gym.$createdAt,
        customDomainEnabled: gym.customDomainEnabled,
        customDomain: gym.customDomain,
        customDomainStatus: gym.customDomainStatus,
        twilioSmsServiceSid: gym.twilioSmsServiceSid,
        twilioWhatsappFrom: gym.twilioWhatsappFrom,
        twilioWhatsappServiceSid: gym.twilioWhatsappServiceSid,
        messagingEnabled: gym.messagingEnabled,
        autoSend: gym.autoSend,
      }}
      sub={
        sub
          ? {
              planName: sub.planName,
              setupFee: sub.setupFee,
              setupFeeStatus: sub.setupFeeStatus,
              monthlyFee: sub.monthlyFee,
              billingMonths: sub.billingMonths,
              billingStartAt: sub.billingStartAt,
              nextBillingAt: sub.nextBillingAt,
              status: sub.status,
              gstRate: sub.gstRate,
              graceDays: sub.graceDays,
              autoSuspend: sub.autoSuspend,
              notes: sub.notes,
            }
          : null
      }
      invoices={d.invoices.map((i) => ({
        id: i.$id,
        number: i.number,
        kind: i.kind,
        sequence: i.sequence,
        description: i.description,
        amount: i.amount,
        tax: i.tax,
        total: i.total,
        status: i.status,
        dueAt: i.dueAt,
        paidAt: i.paidAt,
        method: i.method,
        reference: i.reference,
      }))}
      staff={d.staff}
      members={d.members}
      owner={d.owner}
      subdomainRule={d.subdomainRule}
      customRule={d.customRule}
    />
  );
}
