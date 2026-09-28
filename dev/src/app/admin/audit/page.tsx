import { ShieldCheck } from "@/components/icons";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { listPlatformAudit } from "@/lib/queries/admin";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const rows = await listPlatformAudit(300);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sensitive action across the platform — who did what, when and from where."
        crumbs={[{ label: "Console", href: "/admin" }, { label: "Audit log" }]}
      />
      <div className="surface overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No activity yet" />
        ) : (
          <ul className="divide-y">
            {rows.map((a) => (
              <li key={a.$id} className="flex items-start gap-3 px-5 py-3.5">
                <PersonAvatar name={a.actorName ?? "System"} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{a.actorName}</span>{" "}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px]">{a.action}</span>
                  </p>
                  {a.summary && <p className="mt-0.5 text-sm text-muted-foreground">{a.summary}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{fmtDateTime(a.at)}</p>
                  {a.ip && <p className="font-mono">{a.ip}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
