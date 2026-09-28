"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Dumbbell, Plus, RotateCcw, Star, Ticket, Trash2 } from "@/components/icons";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { Stagger, StaggerItem } from "@/components/kit/motion";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { EmptyState } from "@/components/kit/empty-state";
import { Tag } from "@/components/kit/badges";
import { useConfirm } from "@/components/kit/confirm";
import { Field, AffixInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/kit/segmented";
import { notify } from "@/lib/notify";
import { inr } from "@/lib/format";
import type { Plan, PlanType } from "@/lib/types";
import { savePlanAction, setPlanActiveAction } from "../_actions/plans";

type Form = {
  name: string;
  type: PlanType;
  durationDays: string;
  sessions: string;
  price: string;
  joiningFee: string;
  description: string;
  color: string;
  featured: boolean;
  sortOrder: string;
};
const blank: Form = {
  name: "",
  type: "duration",
  durationDays: "30",
  sessions: "0",
  price: "",
  joiningFee: "0",
  description: "",
  color: "#16a34a",
  featured: false,
  sortOrder: "0",
};
const colors = ["#16a34a", "#84cc16", "#2563eb", "#7c3aed", "#ea580c", "#e11d48"];
const labels: Record<PlanType, string> = { duration: "Duration", sessions: "Sessions", pt: "Personal training" };

export function PlansView({ plans, editable }: { plans: Plan[]; editable: boolean }) {
  const [filter, setFilter] = React.useState<"active" | "archived">("active");
  const [editing, setEditing] = React.useState<Plan | null>(null);
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState<Form>(blank);
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const shown = plans.filter((p) => p.active === (filter === "active"));
  function edit(p: Plan | null) {
    setEditing(p);
    setF(
      p
        ? {
            name: p.name,
            type: p.type,
            durationDays: String(p.durationDays),
            sessions: String(p.sessions),
            price: String(p.price),
            joiningFee: String(p.joiningFee),
            description: p.description ?? "",
            color: p.color ?? "#16a34a",
            featured: p.featured,
            sortOrder: String(p.sortOrder),
          }
        : blank,
    );
    setOpen(true);
  }
  function toggle(p: Plan) {
    void (async () => {
      if (
        p.active &&
        !(await confirm({
          title: `Archive ${p.name}?`,
          description: "Members already using this plan keep it. It will no longer be available for new sales.",
          confirmLabel: "Archive plan",
          destructive: true,
        }))
      )
        return;
      start(async () => {
        const r = await setPlanActiveAction(p.$id, !p.active);
        if (r.ok) {
          notify.success(r.message ?? "Plan updated");
          router.refresh();
        } else notify.error(r.error);
      });
    })();
  }
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Plans" }]}
        title="Membership plans"
        description="Set up the offers your team can sell to members."
        actions={
          editable && (
            <Button onClick={() => edit(null)}>
              <AnimatedIcon icon={Plus} /> New plan
            </Button>
          )
        }
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented
          options={[
            { value: "active", label: `Active (${plans.filter((p) => p.active).length})` },
            { value: "archived", label: `Archived (${plans.filter((p) => !p.active).length})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <span className="hidden text-xs text-muted-foreground sm:block">
          {shown.length} {shown.length === 1 ? "plan" : "plans"}
        </span>
      </div>
      {shown.length ? (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <StaggerItem key={p.$id} className="surface anim-host flex min-w-0 flex-col overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: p.color ?? "#16a34a" }} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl border bg-muted/40">
                    <AnimatedIcon icon={p.type === "duration" ? CalendarDays : p.type === "sessions" ? Ticket : Dumbbell} className="size-5" />
                  </span>
                  <div className="flex gap-1.5">
                    {p.featured && (
                      <Tag tone="lime">
                        <Star className="size-3 fill-current" /> Featured
                      </Tag>
                    )}
                    {!p.active && <Tag>Archived</Tag>}
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">{p.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {labels[p.type]} · {p.durationDays} days{p.type !== "duration" ? ` · ${p.sessions} sessions` : ""}
                </p>
                <p className="tabular mt-4 text-[27px] font-semibold tracking-tight">{inr(p.price)}</p>
                {p.joiningFee > 0 && <p className="text-xs text-muted-foreground">+ {inr(p.joiningFee)} joining fee</p>}
                <p className="mt-3 min-h-10 text-sm text-muted-foreground">{p.description || "No description added."}</p>
                {editable && (
                  <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
                    <Button size="sm" variant="outline" onClick={() => edit(p)}>
                      Edit plan
                    </Button>
                    <Button size="sm" variant={p.active ? "destructive-soft" : "soft"} disabled={pending} onClick={() => toggle(p)}>
                      <AnimatedIcon icon={p.active ? Trash2 : RotateCcw} />
                      {p.active ? "Archive" : "Restore"}
                    </Button>
                  </div>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <div className="surface">
          <EmptyState
            icon={Ticket}
            title={filter === "active" ? "No active plans" : "No archived plans"}
            description={filter === "active" ? "Create a plan to begin selling memberships." : "Plans you archive will appear here."}
            action={
              editable && filter === "active" ? (
                <Button onClick={() => edit(null)}>
                  <AnimatedIcon icon={Plus} /> Create plan
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <div>
            <DialogTitle className="text-lg">{editing ? "Edit plan" : "New plan"}</DialogTitle>
            <DialogDescription className="mt-1">Plan pricing and limits shown to your team during sign up.</DialogDescription>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await savePlanAction(editing?.$id ?? null, {
                  ...f,
                  durationDays: Number(f.durationDays),
                  sessions: Number(f.sessions),
                  price: Number(f.price),
                  joiningFee: Number(f.joiningFee),
                  sortOrder: Number(f.sortOrder),
                });
                if (r.ok) {
                  notify.success(r.message ?? "Plan saved");
                  setOpen(false);
                  router.refresh();
                } else notify.error(r.error);
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Plan name" required className="sm:col-span-2">
              <Input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Monthly unlimited" />
            </Field>
            <Field label="Plan type">
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as PlanType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(labels).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Validity" hint="Calendar days">
              <AffixInput
                type="number"
                min={1}
                max={1100}
                required
                value={f.durationDays}
                onChange={(e) => setF({ ...f, durationDays: e.target.value })}
                trailing="days"
              />
            </Field>
            {f.type !== "duration" && (
              <Field label="Number of sessions" required>
                <Input type="number" min={1} max={1000} required value={f.sessions} onChange={(e) => setF({ ...f, sessions: e.target.value })} />
              </Field>
            )}
            <Field label="Price" required>
              <AffixInput
                leading="₹"
                type="number"
                min={0}
                max={10000000}
                step="0.01"
                required
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </Field>
            <Field label="Joining fee">
              <AffixInput
                leading="₹"
                type="number"
                min={0}
                max={10000000}
                step="0.01"
                value={f.joiningFee}
                onChange={(e) => setF({ ...f, joiningFee: e.target.value })}
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What is included?" />
            </Field>
            <div className="sm:col-span-2">
              <SectionTitle>Plan colour</SectionTitle>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use colour ${c}`}
                    aria-pressed={f.color === c}
                    className="size-8 rounded-full border-2 border-white ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground"
                    style={{ backgroundColor: c }}
                    onClick={() => setF({ ...f, color: c })}
                  />
                ))}
                <Input
                  aria-label="Custom plan colour"
                  type="color"
                  value={f.color}
                  onChange={(e) => setF({ ...f, color: e.target.value })}
                  className="h-8 w-12 p-1"
                />
              </div>
            </div>
            <Field label="Display order">
              <Input type="number" min={0} max={999} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={f.featured} onCheckedChange={(v) => setF({ ...f, featured: v })} /> Feature this plan
            </label>
            <div className="flex justify-end gap-2 border-t pt-4 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save plan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
