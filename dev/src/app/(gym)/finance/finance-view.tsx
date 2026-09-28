"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChartColumn, IndianRupee, Plus, ReceiptText, Trash2, TrendingUp, Wallet } from "@/components/icons";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/kit/motion";
import { StatCard } from "@/components/kit/stat-card";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Tag } from "@/components/kit/badges";
import { useConfirm } from "@/components/kit/confirm";
import { Field, AffixInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EXPENSE_CATS } from "@/lib/appwrite/schema";
import { notify } from "@/lib/notify";
import { fmtDate, inr } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { createExpenseAction, deleteExpenseAction } from "../_actions/finance";
import { DualBarChart } from "./dual-bar-chart";

const categoryLabel = (s: string) => s[0].toUpperCase() + s.slice(1);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function FinanceView({ expenses, months }: { expenses: Expense[]; months: { label: string; income: number; expenses: number }[] }) {
  const current = months.at(-1) ?? { income: 0, expenses: 0 };
  const net = current.income - current.expenses;
  const margin = current.income ? (net / current.income) * 100 : 0;
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" });
  const recent = expenses.filter((e) => e.spentAt.slice(0, 7) === month);
  const breakdown = EXPENSE_CATS.map((cat) => ({ cat, sum: recent.filter((e) => e.category === cat).reduce((n, e) => n + e.amount, 0) }))
    .filter((x) => x.sum > 0)
    .sort((a, b) => b.sum - a.sum);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ category: "rent" as Expense["category"], amount: "", spentAt: today(), vendor: "", note: "" });
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  function remove(e: Expense) {
    void (async () => {
      if (
        !(await confirm({
          title: "Delete this expense?",
          description: `${categoryLabel(e.category)} · ${inr(e.amount)} on ${fmtDate(e.spentAt)}. This cannot be undone.`,
          confirmLabel: "Delete expense",
          destructive: true,
        }))
      )
        return;
      start(async () => {
        const r = await deleteExpenseAction(e.$id);
        if (r.ok) {
          notify.success(r.message ?? "Expense removed");
          router.refresh();
        } else notify.error(r.error);
      });
    })();
  }
  const columns: Column<Expense>[] = [
    { id: "spentAt", header: "Date", sort: (e) => e.spentAt, cell: (e) => <span className="text-muted-foreground">{fmtDate(e.spentAt)}</span> },
    { id: "category", header: "Category", sort: (e) => e.category, cell: (e) => <Tag tone="gray">{categoryLabel(e.category)}</Tag> },
    {
      id: "vendor",
      header: "Vendor / details",
      cell: (e) => (
        <div className="min-w-0">
          <p className="font-medium">{e.vendor || "—"}</p>
          {e.note && (
            <p className="max-w-56 truncate text-xs text-muted-foreground" title={e.note}>
              {e.note}
            </p>
          )}
        </div>
      ),
    },
    { id: "by", header: "Recorded by", hideBelow: "lg", cell: (e) => <span className="text-muted-foreground">{e.recordedByName || "—"}</span> },
    { id: "amount", header: "Amount", align: "right", sort: (e) => e.amount, cell: (e) => <span className="tabular font-semibold">{inr(e.amount)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (e) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${categoryLabel(e.category)} expense`} disabled={pending} onClick={() => remove(e)}>
          <AnimatedIcon icon={Trash2} className="size-4" />
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Finance" }]}
        title="Finance"
        description="Track income, operating costs, and profit at a glance."
        actions={
          <Button onClick={() => setOpen(true)}>
            <AnimatedIcon icon={Plus} /> Add expense
          </Button>
        }
      />
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StaggerItem>
          <StatCard icon={IndianRupee} label="Income this month" value={current.income} fmt="inr" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={Wallet} label="Expenses this month" value={current.expenses} fmt="inr" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={TrendingUp} label="Net profit" value={net} fmt="inr" />
        </StaggerItem>
        <StaggerItem>
          <div className="surface anim-host flex h-full flex-col gap-3 p-4 sm:p-5">
            <span className="grid size-9 place-items-center rounded-[10px] border bg-card shadow-[var(--shadow-card)]">
              <AnimatedIcon icon={ChartColumn} className="size-[18px]" />
            </span>
            <div>
              <p className="text-[13px] text-muted-foreground">Profit margin</p>
              <p className="tabular mt-1 text-[26px] leading-none font-semibold tracking-[-0.02em]">
                <AnimatedNumber value={Math.round(margin * 10) / 10} />%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">After recorded expenses</p>
            </div>
          </div>
        </StaggerItem>
      </Stagger>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="surface p-5">
          <SectionTitle action={<span className="text-xs text-muted-foreground">Last 12 months</span>}>Income vs expenses</SectionTitle>
          <DualBarChart months={months} />
        </div>
        <div className="surface p-5">
          <SectionTitle>Expenses by category</SectionTitle>
          <p className="mb-4 text-xs text-muted-foreground">Current month</p>
          {breakdown.length ? (
            <div className="space-y-4">
              {breakdown.map(({ cat, sum }) => (
                <div key={cat}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm">
                    <span>{categoryLabel(cat)}</span>
                    <span className="tabular font-medium">{inr(sum)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(sum / current.expenses) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">No expenses recorded this month.</div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <DataTable
          rows={expenses}
          columns={columns}
          getId={(e) => e.$id}
          noun={["expense", "expenses"]}
          search={(e) => `${e.category} ${e.vendor ?? ""} ${e.note ?? ""} ${e.recordedByName ?? ""}`}
          searchPlaceholder="Search expenses"
          initialSort={{ id: "spentAt", dir: "desc" }}
          filters={[
            { id: "category", label: "Category", options: EXPENSE_CATS.map((c) => ({ value: c, label: categoryLabel(c) })), match: (e, v) => e.category === v },
          ]}
          empty={{
            icon: ReceiptText,
            title: "No expenses yet",
            description: "Record rent, salaries and other costs to see your true profit.",
            action: (
              <Button onClick={() => setOpen(true)}>
                <AnimatedIcon icon={Plus} /> Add expense
              </Button>
            ),
          }}
        />
      </div>
      <p className="mt-4 rounded-xl bg-muted/55 px-4 py-3 text-xs text-muted-foreground">
        GST on gym services is 5% without input tax credit. GST paid on purchases and operating expenses is therefore part of your cost.
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add expense</SheetTitle>
            <SheetDescription>Record a cost against your gym&apos;s finances.</SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createExpenseAction({
                  ...form,
                  amount: Number(form.amount),
                  spentAt: new Date(`${form.spentAt}T12:00:00+05:30`).toISOString(),
                });
                if (r.ok) {
                  notify.success(r.message ?? "Expense added");
                  setOpen(false);
                  setForm({ category: "rent", amount: "", spentAt: today(), vendor: "", note: "" });
                  router.refresh();
                } else notify.error(r.error);
              });
            }}
          >
            <Field label="Category" required>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Expense["category"] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount" required>
              <AffixInput
                leading="₹"
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Date" required>
              <Input type="date" required value={form.spentAt} max={today()} onChange={(e) => setForm({ ...form, spentAt: e.target.value })} />
            </Field>
            <Field label="Vendor" optional>
              <Input maxLength={128} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Who was paid?" />
            </Field>
            <Field label="Note" optional>
              <Textarea maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Additional details" />
            </Field>
            <div className="mt-auto flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save expense
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
