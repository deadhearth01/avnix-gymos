import { PageHeader } from "@/components/kit/page-header";
import { listPlatformInvoices } from "@/lib/queries/admin";
import { PlatformBilling } from "./platform-billing";

export const metadata = { title: "Platform billing" };

export default async function AdminBillingPage() {
  const invoices = await listPlatformInvoices();
  return (
    <>
      <PageHeader
        title="Platform billing"
        description="Setup fees and monthly maintenance invoices across every gym."
        crumbs={[{ label: "Console", href: "/admin" }, { label: "Billing" }]}
      />
      <PlatformBilling
        invoices={invoices.map((i) => ({
          id: i.$id,
          gymId: i.gymId,
          gymName: i.gymName,
          number: i.number,
          kind: i.kind,
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
      />
    </>
  );
}
