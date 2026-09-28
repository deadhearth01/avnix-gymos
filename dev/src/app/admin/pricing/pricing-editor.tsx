"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "@/components/icons";
import { AffixInput, Field } from "@/components/forms/field";
import { PageHeader } from "@/components/kit/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";
import { inr } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Pricing, PricingPlan } from "@/lib/services/pricing";
import { savePricingAction } from "../actions";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "plan";

const num = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;

export function PricingEditor({ initial }: { initial: Pricing }) {
  const router = useRouter();
  const [p, setP] = React.useState<Pricing>(initial);
  const [saved, setSaved] = React.useState(JSON.stringify(initial));
  const [pending, start] = React.useTransition();
  const dirty = JSON.stringify(p) !== saved;

  const setPlan = (i: number, patch: Partial<PricingPlan>) => setP((x) => ({ ...x, plans: x.plans.map((pl, n) => (n === i ? { ...pl, ...patch } : pl)) }));
  const addPlan = () =>
    setP((x) => {
      let id = "new-plan";
      for (let n = 2; x.plans.some((pl) => pl.id === id); n++) id = `new-plan-${n}`;
      return {
        ...x,
        plans: [
          ...x.plans,
          { id, name: "New plan", description: "", setupFee: 10000, monthlyFee: 1499, billingMonths: 12, gstRate: 18, graceDays: 7, autoSuspend: false },
        ],
      };
    });
  const removePlan = (i: number) =>
    setP((x) => {
      const plans = x.plans.filter((_, n) => n !== i);
      return { ...x, plans, defaultPlanId: plans.some((pl) => pl.id === x.defaultPlanId) ? x.defaultPlanId : (plans[0]?.id ?? "") };
    });

  const save = () =>
    start(async () => {
      // ids follow names so they stay readable in audit logs
      const plans = p.plans.map((pl) => ({ ...pl, id: slug(pl.name) }));
      const defaultIndex = p.plans.findIndex((pl) => pl.id === p.defaultPlanId);
      const next = { ...p, plans, defaultPlanId: plans[Math.max(0, defaultIndex)]?.id ?? "" };
      const r = await savePricingAction(next);
      if (!r.ok) return void notify.error(r.error);
      setP(next);
      setSaved(JSON.stringify(next));
      notify.success("Pricing saved — new gyms will use it");
      router.refresh();
    });

  return (
    <div className="pb-24">
      <PageHeader
        title="Pricing"
        description="Your fixed setup and monthly fees. New gyms pick one of these plans; the fees are applied automatically."
        crumbs={[{ label: "Overview", href: "/admin" }, { label: "Pricing" }]}
        actions={
          <Button variant="outline" onClick={addPlan} disabled={p.plans.length >= 12}>
            <Plus /> Add plan
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {p.plans.map((pl, i) => {
          const isDefault = pl.id === p.defaultPlanId;
          const year = pl.setupFee + pl.monthlyFee * (pl.billingMonths || 12);
          return (
            <section key={i} className={cn("surface flex flex-col p-5", isDefault && "ring-2 ring-primary/40")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    aria-label="Plan name"
                    value={pl.name}
                    maxLength={64}
                    onChange={(e) => setPlan(i, { name: e.target.value })}
                    className="h-10 text-base font-semibold"
                  />
                  <Input
                    aria-label="Short description"
                    value={pl.description}
                    maxLength={160}
                    placeholder="Who it’s for"
                    onChange={(e) => setPlan(i, { description: e.target.value })}
                  />
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${pl.name}`} disabled={p.plans.length === 1} onClick={() => removePlan(i)}>
                  <Trash2 />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Setup fee">
                  <AffixInput leading="₹" inputMode="decimal" value={String(pl.setupFee)} onChange={(e) => setPlan(i, { setupFee: num(e.target.value) })} />
                </Field>
                <Field label="Monthly fee">
                  <AffixInput
                    leading="₹"
                    trailing="/mo"
                    inputMode="decimal"
                    value={String(pl.monthlyFee)}
                    onChange={(e) => setPlan(i, { monthlyFee: num(e.target.value) })}
                  />
                </Field>
                <Field label="Contract" hint="0 = until cancelled">
                  <AffixInput
                    trailing="months"
                    inputMode="numeric"
                    value={String(pl.billingMonths)}
                    onChange={(e) => setPlan(i, { billingMonths: Math.min(120, num(e.target.value)) })}
                  />
                </Field>
                <Field label="GST">
                  <AffixInput
                    trailing="%"
                    inputMode="decimal"
                    value={String(pl.gstRate)}
                    onChange={(e) => setPlan(i, { gstRate: Math.min(28, num(e.target.value)) })}
                  />
                </Field>
                <Field label="Grace period">
                  <AffixInput
                    trailing="days"
                    inputMode="numeric"
                    value={String(pl.graceDays)}
                    onChange={(e) => setPlan(i, { graceDays: Math.min(90, num(e.target.value)) })}
                  />
                </Field>
                <label className="flex items-end justify-between gap-2 pb-2 text-sm">
                  <span className="text-muted-foreground">Auto-pause when overdue</span>
                  <Switch checked={pl.autoSuspend} onCheckedChange={(v) => setPlan(i, { autoSuspend: v })} />
                </label>
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-sm">
                <span className="text-muted-foreground">
                  First year <span className="font-semibold text-foreground tabular-nums">{inr(year * (1 + pl.gstRate / 100))}</span> incl. GST
                </span>
                {isDefault ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Check className="size-4" /> Default
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setP((x) => ({ ...x, defaultPlanId: pl.id }))}>
                    Make default
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <label className="surface mt-4 flex items-center justify-between gap-4 p-5">
        <span>
          <span className="block text-sm font-medium">Allow custom pricing for individual gyms</span>
          <span className="block text-sm text-muted-foreground">
            Off: every new gym is billed exactly at its plan’s rates. On: you can override fees for a gym while creating it.
          </span>
        </span>
        <Switch checked={p.allowCustom} onCheckedChange={(v) => setP((x) => ({ ...x, allowCustom: v }))} />
      </label>
      <p className="mt-3 text-xs text-muted-foreground">
        Changes apply to gyms created from now on. Existing gyms keep their subscription — edit those from the gym’s page.
      </p>

      <div
        aria-hidden={!dirty}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur transition-all duration-300",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2">
          <span className="mr-auto text-sm">Unsaved pricing changes</span>
          <Button variant="outline" onClick={() => setP(JSON.parse(saved) as Pricing)} disabled={pending}>
            Discard
          </Button>
          <Button onClick={save} loading={pending}>
            Save pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
