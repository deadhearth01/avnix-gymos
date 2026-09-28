import { Query } from "node-appwrite";
import { requireCap } from "@/lib/auth/session";
import { billingData } from "@/lib/queries/gym";
import { repo } from "@/lib/data/repo";
import { T } from "@/lib/appwrite/schema";
import { PageHeader } from "@/components/kit/page-header";
import { LiveRefresh } from "@/components/realtime/realtime-provider";
import type { Member } from "@/lib/types";
import { BillingView } from "./billing-view";
import { billingSummary } from "./summary";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const ctx = await requireCap("billing.view");
  const sp = await searchParams;
  const [{ invoices, payments }, dues] = await Promise.all([
    billingData(ctx.gymId),
    repo(ctx.gymId).all<Member>(T.members, [Query.greaterThan("balanceDue", 0), Query.orderDesc("balanceDue")], 2000),
  ]);
  return (
    <>
      <LiveRefresh tables={["payments", "invoices"]} />
      <PageHeader
        title="Billing"
        description="GST invoices, payments and dues — everything your accountant needs."
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Billing" }]}
      />
      <BillingView
        initialTab={typeof sp.tab === "string" ? sp.tab : "invoices"}
        openCollect={sp.collect === "1"}
        summary={billingSummary(invoices, payments)}
        invoices={invoices.map((i) => ({
          id: i.$id,
          number: i.number,
          memberId: i.memberId,
          memberName: i.memberName,
          issuedAt: i.issuedAt,
          taxable: i.taxable,
          cgst: i.cgst,
          sgst: i.sgst,
          igst: i.igst,
          total: i.total,
          paid: i.paid,
          balance: i.balance,
          status: i.status,
        }))}
        payments={payments.map((p) => ({
          id: p.$id,
          memberId: p.memberId,
          memberName: p.memberName,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          paidAt: p.paidAt,
          invoiceNumber: p.invoiceNumber,
          by: p.recordedByName,
        }))}
        dues={dues.map((m) => ({
          id: m.$id,
          name: m.name,
          phone: m.phone,
          code: m.code,
          planName: m.planName,
          balanceDue: m.balanceDue,
          expiresAt: m.expiresAt,
        }))}
        gymName={ctx.gym.name}
      />
    </>
  );
}
