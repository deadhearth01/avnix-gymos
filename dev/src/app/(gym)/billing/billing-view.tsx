"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Download, FileText, IndianRupee, Landmark, Loader2, MessageCircle, Percent, ReceiptText, Search, Wallet } from "lucide-react";
import { DataTable, type Column } from "@/components/kit/data-table";
import { TabsBar, useTabParam } from "@/components/kit/tabs-bar";
import { Tag, type Tone } from "@/components/kit/badges";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { AnimatedNumber, Stagger, StaggerItem, HoverLift } from "@/components/kit/motion";
import { Delta } from "@/components/kit/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, fmtDateTime, fmtPhone, inr, pct } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { downloadCsv } from "@/lib/csv";
import { searchAction } from "../_actions/common";

type Inv = {
  id: string;
  number: string;
  memberId: string;
  memberName: string;
  issuedAt: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paid: number;
  balance: number;
  status: "paid" | "partial" | "unpaid" | "void";
};
type Pay = {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  invoiceNumber: string | null;
  by: string | null;
};
type Due = { id: string; name: string; phone: string; code: string | null; planName: string | null; balanceDue: number; expiresAt: string | null };
type Summary = ReturnType<typeof import("./summary").billingSummary>;

const TABS = ["invoices", "payments", "dues"] as const;
const INV_TONE: Record<Inv["status"], Tone> = { paid: "lime", partial: "amber", unpaid: "red", void: "gray" };
const METHOD: Record<string, { label: string; tone: Tone }> = {
  upi: { label: "UPI", tone: "violet" },
  cash: { label: "Cash", tone: "lime" },
  card: { label: "Card", tone: "blue" },
  bank: { label: "Bank", tone: "amber" },
  other: { label: "Other", tone: "gray" },
};

function csv(name: string, head: string[], rows: (string | number | null | undefined)[][]) {
  downloadCsv(name, [head, ...rows]);
}

export function BillingView({
  initialTab,
  openCollect,
  summary: s,
  invoices,
  payments,
  dues,
  gymName,
}: {
  initialTab: string;
  openCollect: boolean;
  summary: Summary;
  invoices: Inv[];
  payments: Pay[];
  dues: Due[];
  gymName: string;
}) {
  const [tab, setTab] = useTabParam<(typeof TABS)[number]>(initialTab as (typeof TABS)[number], TABS);
  const [picker, setPicker] = React.useState(openCollect);
  const methodTotal = s.methods.reduce((a, m) => a + m.amount, 0) || 1;

  const invCols: Column<Inv>[] = [
    {
      id: "number",
      header: "Invoice",
      sort: (r) => r.issuedAt,
      cell: (r) => (
        <Link href={`/billing/invoices/${r.id}`} className="anim-host flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
            <AnimatedIcon icon={FileText} className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-medium hover:underline">{r.number}</span>
            <span className="block text-xs text-muted-foreground">{fmtDate(r.issuedAt)}</span>
          </span>
        </Link>
      ),
    },
    {
      id: "member",
      header: "Member",
      sort: (r) => r.memberName.toLowerCase(),
      cell: (r) => (
        <Link href={`/members/${r.memberId}`} className="flex items-center gap-2 hover:underline">
          <PersonAvatar name={r.memberName} size={26} /> <span className="truncate text-sm">{r.memberName}</span>
        </Link>
      ),
    },
    {
      id: "taxable",
      header: "Taxable",
      align: "right",
      hideBelow: "lg",
      sort: (r) => r.taxable,
      cell: (r) => <span className="tabular text-sm text-muted-foreground">{inr(r.taxable, true)}</span>,
    },
    {
      id: "gst",
      header: "GST",
      align: "right",
      hideBelow: "lg",
      sort: (r) => r.cgst + r.sgst + r.igst,
      cell: (r) => <span className="tabular text-sm text-muted-foreground">{inr(r.cgst + r.sgst + r.igst, true)}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sort: (r) => r.total,
      cell: (r) => <span className="tabular text-sm font-semibold">{inr(r.total, true)}</span>,
    },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      hideBelow: "md",
      sort: (r) => r.balance,
      cell: (r) =>
        r.balance > 0 ? <span className="tabular text-sm font-medium text-danger-ink">{inr(r.balance, true)}</span> : <span className="text-subtle">—</span>,
    },
    {
      id: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <Tag tone={INV_TONE[r.status]} className="capitalize">
          {r.status}
        </Tag>
      ),
    },
  ];

  const payCols: Column<Pay>[] = [
    { id: "date", header: "Received", sort: (r) => r.paidAt, cell: (r) => <span className="tabular text-sm">{fmtDateTime(r.paidAt)}</span> },
    {
      id: "member",
      header: "Member",
      sort: (r) => r.memberName.toLowerCase(),
      cell: (r) => (
        <Link href={`/members/${r.memberId}`} className="flex items-center gap-2 hover:underline">
          <PersonAvatar name={r.memberName} size={26} /> <span className="truncate text-sm">{r.memberName}</span>
        </Link>
      ),
    },
    {
      id: "method",
      header: "Method",
      sort: (r) => r.method,
      cell: (r) => <Tag tone={METHOD[r.method]?.tone ?? "gray"}>{METHOD[r.method]?.label ?? r.method}</Tag>,
    },
    {
      id: "ref",
      header: "Reference",
      hideBelow: "lg",
      cell: (r) => <span className="text-sm text-muted-foreground">{r.reference || r.invoiceNumber || "—"}</span>,
    },
    { id: "by", header: "Recorded by", hideBelow: "xl", cell: (r) => <span className="text-sm text-muted-foreground">{r.by ?? "—"}</span> },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sort: (r) => r.amount,
      cell: (r) => <span className="tabular text-sm font-semibold text-success-ink">+{inr(r.amount, true)}</span>,
    },
  ];

  const dueCols: Column<Due>[] = [
    {
      id: "member",
      header: "Member",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <Link href={`/members/${r.id}`} className="flex items-center gap-3 hover:underline">
          <PersonAvatar name={r.name} size={32} />
          <span>
            <span className="block text-sm font-medium">{r.name}</span>
            <span className="block text-xs text-muted-foreground">
              {r.code} · {fmtPhone(r.phone)}
            </span>
          </span>
        </Link>
      ),
    },
    { id: "plan", header: "Plan", hideBelow: "md", cell: (r) => <span className="text-sm">{r.planName ?? "—"}</span> },
    {
      id: "exp",
      header: "Plan ends",
      hideBelow: "lg",
      sort: (r) => r.expiresAt ?? "",
      cell: (r) => <span className="text-sm text-muted-foreground">{fmtDate(r.expiresAt)}</span>,
    },
    {
      id: "due",
      header: "Due",
      align: "right",
      sort: (r) => r.balanceDue,
      cell: (r) => (
        <Tag tone="red" className="tabular">
          {inr(r.balanceDue)}
        </Tag>
      ),
    },
    {
      id: "act",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <a
            href={
              waLink(
                r.phone,
                `Hi ${r.name.split(" ")[0]}, a gentle reminder that ${inr(r.balanceDue)} is pending on your ${gymName} membership. You can pay by UPI or at the desk. Thank you! 🙏`,
              ) ?? "#"
            }
            target="_blank"
            rel="noreferrer"
            data-feedback="success"
            className="anim-host inline-flex h-8 items-center gap-1 rounded-lg bg-success-soft px-2.5 text-xs font-medium text-success-ink hover:bg-success-soft/70"
          >
            <AnimatedIcon icon={MessageCircle} className="size-3.5" /> Remind
          </a>
          <Button size="sm" asChild>
            <Link href={`/members/${r.id}?action=collect`}>Collect</Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StaggerItem>
          <Kpi
            icon={IndianRupee}
            label={`Collected · ${s.monthLabel}`}
            value={s.collected}
            delta={pct(s.collected, s.collectedPrev)}
            hint={`${inr(s.collectedPrev)} last month`}
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={ReceiptText} label="Invoiced this month" value={s.invoiced} hint={`${s.invoicedCount} invoices`} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={Percent} label="GST this month" value={s.gstThisMonth} hint={`on ${inr(s.taxableThisMonth)} taxable`} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={Wallet} label="Outstanding" value={s.outstanding} hint={`${s.unpaidCount} open invoices`} />
        </StaggerItem>
      </Stagger>

      <div className="surface mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-semibold">How members paid this month</p>
          <Button size="sm" onClick={() => setPicker(true)}>
            <AnimatedIcon icon={Wallet} /> Collect a payment
          </Button>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-track">
          {s.methods
            .filter((m) => m.amount > 0)
            .map((m, i) => (
              <motion.div
                key={m.method}
                initial={{ width: 0 }}
                animate={{ width: `${(m.amount / methodTotal) * 100}%` }}
                transition={{ delay: i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={{ upi: "bg-violet", cash: "bg-lime", card: "bg-info", bank: "bg-warning", other: "bg-subtle" }[m.method]}
              />
            ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {s.methods.map((m) => (
            <span key={m.method} className="flex items-center gap-2">
              <span
                className={`size-2.5 rounded-full ${{ upi: "bg-violet", cash: "bg-lime", card: "bg-info", bank: "bg-warning", other: "bg-subtle" }[m.method]}`}
              />
              {METHOD[m.method].label} <span className="tabular font-medium">{inr(m.amount)}</span>
            </span>
          ))}
        </div>
      </div>

      <TabsBar
        className="mt-6 mb-4"
        value={tab}
        onChange={setTab}
        layoutId="billing-tabs"
        tabs={[
          { value: "invoices", label: `Invoices · ${invoices.length}`, icon: FileText },
          { value: "payments", label: `Payments · ${payments.length}`, icon: Landmark },
          { value: "dues", label: `Dues · ${dues.length}`, icon: Wallet },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {tab === "invoices" && (
            <DataTable
              rows={invoices}
              columns={invCols}
              getId={(r) => r.id}
              noun={["invoice", "invoices"]}
              search={(r) => `${r.number} ${r.memberName}`}
              searchPlaceholder="Invoice no. or member"
              initialSort={{ id: "number", dir: "desc" }}
              rowHref={(r) => `/billing/invoices/${r.id}`}
              mobileCard={(r) => (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.memberName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.number} · {fmtDate(r.issuedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-semibold">{inr(r.total)}</p>
                    <Tag tone={INV_TONE[r.status]} className="h-5 text-[11px] capitalize">
                      {r.status}
                    </Tag>
                  </div>
                </div>
              )}
              filters={[
                {
                  id: "status",
                  label: "Status",
                  allLabel: "All statuses",
                  options: (["paid", "partial", "unpaid", "void"] as const).map((v) => ({
                    value: v,
                    label: v[0].toUpperCase() + v.slice(1),
                    count: invoices.filter((i) => i.status === v).length,
                  })),
                  match: (r, v) => r.status === v,
                },
              ]}
              toolbar={
                <Button
                  variant="outline"
                  onClick={() =>
                    csv(
                      `gst-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Invoice no", "Date", "Customer", "SAC", "Taxable value", "CGST", "SGST", "IGST", "Invoice value", "Paid", "Balance", "Status"],
                      invoices
                        .filter((i) => i.status !== "void")
                        .map((i) => [
                          i.number,
                          i.issuedAt.slice(0, 10),
                          i.memberName,
                          "999723",
                          i.taxable,
                          i.cgst,
                          i.sgst,
                          i.igst,
                          i.total,
                          i.paid,
                          i.balance,
                          i.status,
                        ]),
                    )
                  }
                >
                  <AnimatedIcon icon={Download} /> GST export
                </Button>
              }
              empty={{ icon: ReceiptText, title: "No invoices yet", description: "Invoices are created automatically when you sell or renew a plan." }}
            />
          )}
          {tab === "payments" && (
            <DataTable
              rows={payments}
              columns={payCols}
              getId={(r) => r.id}
              noun={["payment", "payments"]}
              search={(r) => `${r.memberName} ${r.reference ?? ""} ${r.invoiceNumber ?? ""}`}
              searchPlaceholder="Member or reference"
              initialSort={{ id: "date", dir: "desc" }}
              mobileCard={(r) => (
                <div className="flex items-center gap-3">
                  <PersonAvatar name={r.memberName} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.memberName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {METHOD[r.method]?.label} · {fmtDateTime(r.paidAt)}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold text-success-ink">+{inr(r.amount)}</span>
                </div>
              )}
              filters={[
                {
                  id: "method",
                  label: "Method",
                  allLabel: "All methods",
                  options: Object.entries(METHOD).map(([v, m]) => ({ value: v, label: m.label, count: payments.filter((p) => p.method === v).length })),
                  match: (r, v) => r.method === v,
                },
              ]}
              toolbar={
                <Button
                  variant="outline"
                  onClick={() =>
                    csv(
                      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Date", "Member", "Method", "Reference", "Invoice", "Amount", "Recorded by"],
                      payments.map((p) => [p.paidAt.slice(0, 16).replace("T", " "), p.memberName, p.method, p.reference, p.invoiceNumber, p.amount, p.by]),
                    )
                  }
                >
                  <AnimatedIcon icon={Download} /> Export
                </Button>
              }
              empty={{ icon: Landmark, title: "No payments yet" }}
            />
          )}
          {tab === "dues" && (
            <DataTable
              rows={dues}
              columns={dueCols}
              getId={(r) => r.id}
              noun={["member owes", "members owe"]}
              search={(r) => `${r.name} ${r.phone} ${r.code ?? ""}`}
              initialSort={{ id: "due", dir: "desc" }}
              rowHref={(r) => `/members/${r.id}?action=collect`}
              mobileCard={(r) => (
                <div className="flex items-center gap-3">
                  <PersonAvatar name={r.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.planName ?? "—"}</p>
                  </div>
                  <Tag tone="red" className="tabular">
                    {inr(r.balanceDue)}
                  </Tag>
                </div>
              )}
              empty={{ icon: Wallet, title: "No dues 🎉", description: "Every member is fully paid." }}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <CollectPicker open={picker} onClose={() => setPicker(false)} />
    </>
  );
}

function Kpi({ icon, label, value, hint, delta }: { icon: typeof Wallet; label: string; value: number; hint?: string; delta?: number }) {
  return (
    <HoverLift className="surface flex flex-col gap-3 p-4 sm:p-5">
      <span className="grid size-9 place-items-center rounded-[10px] border bg-card text-foreground/80 shadow-[var(--shadow-card)]">
        <AnimatedIcon icon={icon} className="size-[18px]" />
      </span>
      <div>
        <p className="truncate text-[13px] text-muted-foreground">{label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <AnimatedNumber value={value} fmt="inr" className="text-[24px] leading-none font-semibold tracking-[-0.02em]" />
          {delta != null && delta !== 0 && <Delta value={delta} />}
        </div>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </HoverLift>
  );
}

/** Search a member, then jump to their profile with the collect dialog open. */
function CollectPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ id: string; title: string; subtitle?: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (q.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchAction(q);
      if (alive) {
        setHits(r);
        setLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  const shown = q.trim().length >= 2 ? hits : [];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Collect a payment</DialogTitle>
        <DialogDescription>Find the member — you can renew their plan or clear dues next.</DialogDescription>
        <label className="mt-2 flex h-11 items-center gap-2 rounded-xl border bg-card px-3 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
          {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Search className="size-4 text-muted-foreground" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLoading(e.target.value.trim().length >= 2);
            }}
            placeholder="Name, phone or code"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <ul className="-mx-2 mt-1 max-h-72 overflow-y-auto">
          {shown.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => router.push(`/members/${h.id}?action=renew`)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
              >
                <PersonAvatar name={h.title} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
