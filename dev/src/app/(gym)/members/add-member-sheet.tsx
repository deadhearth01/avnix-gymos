"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { UserPlus } from "@/components/icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, AffixInput } from "@/components/forms/field";
import { Segmented } from "@/components/kit/segmented";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PlanSaleFields, initialSale, saleTotals, type PlanOption, type SaleState } from "@/components/gym/plan-sale";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { createMemberAction } from "../_actions/members";

export type { PlanOption };

const GOALS = ["Weight loss", "Muscle gain", "General fitness", "Strength", "Sports", "Flexibility"];
const SOURCES = [
  { value: "walkin", label: "Walk-in" },
  { value: "referral", label: "Referral" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

const blank = () => ({
  name: "",
  phone: "",
  email: "",
  gender: "unspecified" as "male" | "female" | "other" | "unspecified",
  dob: "",
  lang: "en" as "en" | "te" | "hi",
  goal: "",
  source: "walkin",
  emergencyName: "",
  emergencyPhone: "",
});

export function AddMemberSheet({
  open,
  onOpenChange,
  plans,
  gst,
  canBill,
  gymName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans: PlanOption[];
  gst: { rate: number; inclusive: boolean };
  canBill: boolean;
  gymName: string;
}) {
  const router = useRouter();
  const [f, setF] = React.useState(blank);
  const [withPlan, setWithPlan] = React.useState(canBill && plans.length > 0);
  const [sale, setSale] = React.useState<SaleState>(() => initialSale(plans[0]?.id));
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();
  const [saleKey, setSaleKey] = React.useState(() => crypto.randomUUID());
  const totals = withPlan ? saleTotals(sale, plans, gst, true) : null;

  const reset = () => {
    setF(blank());
    setSale(initialSale(plans[0]?.id));
    setErrors({});
  };

  const submit = (e: React.FormEvent, another = false) => {
    e.preventDefault();
    start(async () => {
      const r = await createMemberAction({
        member: { ...f, email: f.email || "", dob: f.dob || undefined, goal: f.goal || undefined, source: f.source as never },
        sale:
          withPlan && totals
            ? {
                planId: sale.planId,
                startAt: sale.startAt || undefined,
                discount: Number(sale.discount) || 0,
                payment: totals.paying > 0 ? { amount: totals.paying, method: sale.method, reference: sale.reference || undefined } : null,
                idempotencyKey: saleKey,
              }
            : null,
      });
      if (!r.ok) {
        const fe: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(r.fieldErrors ?? {})) fe[k.replace(/^member\./, "")] = v;
        setErrors(fe);
        notify.error(r.error);
        return;
      }
      notify.success(`${f.name} added${withPlan && totals ? ` · ${totals.plan.name}` : ""}`, {
        description: withPlan ? "Welcome message queued on WhatsApp." : undefined,
      });
      reset();
      setSaleKey(crypto.randomUUID());
      if (another) return;
      onOpenChange(false);
      router.push(`/members/${r.data!.id}`);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
        <div className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-success-soft text-success-ink">
              <UserPlus className="size-5" />
            </span>
            <div>
              <SheetTitle className="text-lg">Add member</SheetTitle>
              <SheetDescription>Join someone to {gymName} in under a minute.</SheetDescription>
            </div>
          </div>
        </div>

        <form id="add-member" onSubmit={submit} className="flex-1 scrollbar-thin overflow-y-auto px-6 py-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name} className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sai Kiran" autoFocus autoComplete="off" />
            </Field>
            <Field label="Mobile" required error={errors.phone}>
              <AffixInput
                leading="+91"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value.replace(/[^\d ]/g, "").slice(0, 12) })}
                inputMode="tel"
                placeholder="98765 43210"
              />
            </Field>
            <Field label="Email" optional error={errors.email}>
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@gmail.com" />
            </Field>
            <Field label="Gender">
              <Segmented
                size="md"
                stretch
                value={f.gender}
                onChange={(v) => setF({ ...f, gender: v })}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
            </Field>
            <Field label="Birthday" optional hint="For birthday wishes">
              <Input type="date" value={f.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, dob: e.target.value })} />
            </Field>
            <Field label="Message language" hint="Reminders use this language" className="sm:col-span-2">
              <Segmented
                size="md"
                stretch
                value={f.lang}
                onChange={(v) => setF({ ...f, lang: v })}
                options={[
                  { value: "en", label: "English" },
                  { value: "te", label: "తెలుగు" },
                  { value: "hi", label: "हिंदी" },
                ]}
              />
            </Field>
            <Field label="Source" className="sm:col-span-2">
              <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium">Goal</p>
              <div className="flex flex-wrap gap-1.5">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={f.goal === g}
                    onClick={() => setF({ ...f, goal: f.goal === g ? "" : g })}
                    className={cn(
                      "h-8 rounded-full border px-3 text-[13px] transition-colors",
                      f.goal === g ? "border-primary bg-success-soft text-success-ink" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Emergency contact" optional>
              <Input value={f.emergencyName} onChange={(e) => setF({ ...f, emergencyName: e.target.value })} placeholder="Name" />
            </Field>
            <Field label="Their phone" optional>
              <AffixInput
                leading="+91"
                value={f.emergencyPhone}
                onChange={(e) => setF({ ...f, emergencyPhone: e.target.value.replace(/[^\d ]/g, "").slice(0, 12) })}
                inputMode="tel"
              />
            </Field>
          </div>

          {canBill && plans.length > 0 && (
            <div className="mt-6 rounded-2xl border">
              <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">Start a membership now</span>
                  <span className="block text-xs text-muted-foreground">Creates a GST invoice and records the payment.</span>
                </span>
                <Switch checked={withPlan} onCheckedChange={setWithPlan} />
              </label>
              <AnimatePresence initial={false}>
                {withPlan && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t p-4">
                      <PlanSaleFields plans={plans} sale={sale} onChange={setSale} gst={gst} withJoining />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="ghost" onClick={(e) => submit(e as unknown as React.FormEvent, true)} disabled={pending}>
            Save &amp; add another
          </Button>
          <Button type="submit" form="add-member" loading={pending}>
            <AnimatedIcon icon={UserPlus} /> {withPlan && totals ? `Add & collect ₹${Math.round(totals.paying).toLocaleString("en-IN")}` : "Add member"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
