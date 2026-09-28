"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CreditCard, Download, KeyRound, RefreshCw } from "@/components/icons";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Tag, type Tone } from "@/components/kit/badges";
import { BrandMark } from "@/components/shell/sidebar";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { notify } from "@/lib/notify";
import { downloadCsv } from "@/lib/csv";
import { fmtDate, inr } from "@/lib/format";
import { setPlatformInvoiceStatusAction, syncAllBillingAction } from "../actions";

type Inv = {
  id: string;
  gymId: string;
  gymName: string;
  number: string;
  kind: string;
  description: string | null;
  amount: number;
  tax: number;
  total: number;
  status: "due" | "paid" | "overdue" | "waived" | "void";
  dueAt: string | null;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
};
const TONE: Record<Inv["status"], Tone> = { paid: "lime", due: "amber", overdue: "red", waived: "gray", void: "gray" };

export function PlatformBilling({ invoices }: { invoices: Inv[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const sum = (s: Inv["status"][]) => invoices.filter((i) => s.includes(i.status)).reduce((a, i) => a + i.total, 0);

  const columns: Column<Inv>[] = [
    {
      id: "gym",
      header: "Gym",
      sort: (r) => r.gymName.toLowerCase(),
      cell: (r) => (
        <Link href={`/admin/gyms/${r.gymId}?tab=billing`} className="flex items-center gap-2.5 hover:underline">
          <BrandMark name={r.gymName} size={28} /> <span className="truncate text-sm font-medium">{r.gymName}</span>
        </Link>
      ),
    },
    {
      id: "number",
      header: "Invoice",
      sort: (r) => r.number,
      cell: (r) => (
        <span className="flex items-center gap-2">
          {r.kind === "setup" ? <KeyRound className="size-3.5 text-violet-ink" /> : <CreditCard className="size-3.5 text-muted-foreground" />}
          <span>
            <span className="block text-sm">{r.number}</span>
            <span className="block text-xs text-muted-foreground">{r.description}</span>
          </span>
        </span>
      ),
    },
    { id: "due", header: "Due", sort: (r) => r.dueAt ?? "", cell: (r) => <span className="tabular text-sm">{fmtDate(r.dueAt)}</span> },
    {
      id: "total",
      header: "Total",
      align: "right",
      sort: (r) => r.total,
      cell: (r) => <span className="tabular text-sm font-semibold">{inr(r.total, true)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <Tag tone={TONE[r.status]} className="capitalize">
          {r.status}
        </Tag>
      ),
    },
    {
      id: "act",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        r.status === "due" || r.status === "overdue" ? (
          <Button
            size="xs"
            variant="soft"
            onClick={() =>
              start(async () => {
                const res = await setPlatformInvoiceStatusAction(r.id, "paid", { method: "upi" });
                if (res.ok) {
                  notify.success(`${r.number} marked paid`);
                  router.refresh();
                } else notify.error(res.error);
              })
            }
          >
            <CircleCheck /> Mark paid
          </Button>
        ) : r.paidAt ? (
          <span className="text-xs text-muted-foreground">paid {fmtDate(r.paidAt)}</span>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Collected", sum(["paid"])],
          ["Due", sum(["due"])],
          ["Overdue", sum(["overdue"])],
          ["Waived", sum(["waived"])],
        ].map(([l, v]) => (
          <div key={l as string} className="surface p-4">
            <p className="text-[13px] text-muted-foreground">{l}</p>
            <p className="tabular mt-1 text-xl font-semibold">{inr(v as number)}</p>
          </div>
        ))}
      </div>
      <DataTable
        rows={invoices}
        columns={columns}
        getId={(r) => r.id}
        noun={["invoice", "invoices"]}
        search={(r) => `${r.gymName} ${r.number}`}
        initialSort={{ id: "due", dir: "desc" }}
        filters={[
          {
            id: "status",
            label: "Status",
            allLabel: "All statuses",
            options: (["due", "overdue", "paid", "waived", "void"] as const).map((s) => ({
              value: s,
              label: s[0].toUpperCase() + s.slice(1),
              count: invoices.filter((i) => i.status === s).length,
            })),
            match: (r, v) => r.status === v,
          },
        ]}
        toolbar={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadCsv("avnix-platform-invoices.csv", [
                  ["Invoice", "Gym", "Kind", "Due", "Amount", "GST", "Total", "Status", "Paid on", "Method", "Reference"],
                  ...invoices.map((i) => [
                    i.number,
                    i.gymName,
                    i.kind,
                    i.dueAt?.slice(0, 10),
                    i.amount,
                    i.tax,
                    i.total,
                    i.status,
                    i.paidAt?.slice(0, 10),
                    i.method,
                    i.reference,
                  ]),
                ]);
              }}
            >
              <AnimatedIcon icon={Download} /> Export
            </Button>
            <Button
              variant="outline"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await syncAllBillingAction();
                  if (r.ok) {
                    notify.success(`Billing synced for ${r.data?.synced} gyms`);
                    router.refresh();
                  } else notify.error(r.error);
                })
              }
            >
              <AnimatedIcon icon={RefreshCw} /> Sync now
            </Button>
          </>
        }
        empty={{ icon: CreditCard, title: "No invoices yet", description: "Invoices are generated automatically from each gym's subscription." }}
      />
    </>
  );
}
