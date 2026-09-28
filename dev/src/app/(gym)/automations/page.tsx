import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { automationsData } from "@/lib/queries/gym";
import { PLAYBOOKS } from "@/lib/domain/playbooks";
import { PageHeader } from "@/components/kit/page-header";
import { LiveRefresh } from "@/components/realtime/realtime-provider";
import { AutomationsView } from "./automations-view";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const ctx = await requireCap("automations.view");
  const d = await automationsData(ctx.gymId);
  const byKey = new Map(d.automations.map((a) => [a.key, a]));
  return (
    <>
      <LiveRefresh tables={["messages"]} />
      <PageHeader
        title="Automations"
        description="WhatsApp journeys that welcome, remind and win back members — in English and Telugu."
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Automations" }]}
      />
      <AutomationsView
        gymName={ctx.gym.name}
        canManage={can(ctx.role, "automations.manage")}
        canSend={can(ctx.role, "messages.send")}
        delivery={{
          enabled: ctx.gym.messagingEnabled,
          auto: ctx.gym.autoSend,
          whatsapp: !!(ctx.gym.twilioWhatsappFrom || ctx.gym.twilioWhatsappServiceSid),
          sms: !!ctx.gym.twilioSmsServiceSid,
          lastRun: ctx.gym.journeysRunAt,
        }}
        counts={d.counts}
        playbooks={PLAYBOOKS.map((p) => {
          const a = byKey.get(p.key);
          let cfg: { offsets?: number[]; contentSid?: string } = {};
          try {
            cfg = a?.config ? JSON.parse(a.config) : {};
          } catch {}
          return {
            key: p.key,
            title: p.title,
            description: p.description,
            category: p.category,
            trigger: p.trigger,
            offsetsLabel: p.offsetsLabel ?? null,
            variables: p.variables,
            defaultEn: p.en,
            defaultTe: p.te,
            enabled: a?.enabled ?? p.defaultEnabled,
            channel: a?.channel ?? "whatsapp",
            templateEn: a?.templateEn ?? "",
            templateTe: a?.templateTe ?? "",
            offsets: cfg.offsets?.length ? cfg.offsets : (p.defaultOffsets ?? []),
            contentSid: cfg.contentSid ?? "",
            sent30: d.messages.filter((m) => m.playbook === p.key && ["sent", "delivered", "read", "manual"].includes(m.status)).length,
          };
        })}
        messages={d.messages.map((m) => ({
          id: m.$id,
          memberId: m.memberId,
          leadId: m.leadId,
          name: m.name,
          phone: m.phone,
          playbook: m.playbook,
          channel: m.channel,
          body: m.body,
          status: m.status,
          error: m.error,
          at: m.sentAt ?? m.$createdAt,
          by: m.by,
        }))}
      />
    </>
  );
}
