"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AffixInput, Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { notify } from "@/lib/notify";
import { changePasswordAction } from "@/app/(gym)/_actions/settings";
import { completeOnboardingAction } from "./actions";

type Plan = { id: string; name: string; type: string; durationDays: number; sessions: number; price: number; active: boolean };
type State = {
  gym: { name: string; city: string; address: string; phone: string; gstin: string; brandColor: string };
  plans: Plan[];
  site: { tagline: string; heroText: string; hours: { days: string; open: string; close: string }[]; showPrices: boolean; showTrial: boolean };
};

const SWATCHES = ["#16a34a", "#ea580c", "#2563eb", "#dc2626", "#7c3aed", "#0f766e", "#ca8a04", "#18181b"];

function planLength(p: Plan) {
  if (p.type !== "duration") return `${p.sessions} sessions`;
  const m = Math.round(p.durationDays / 30);
  return m > 0 && Math.abs(p.durationDays - m * 30) <= 5 ? `${m} month${m === 1 ? "" : "s"}` : `${p.durationDays} days`;
}

export function OnboardingWizard({
  ownerName,
  mustChangePassword,
  initial,
  slug,
  rootDomain,
}: {
  ownerName: string;
  mustChangePassword: boolean;
  initial: State;
  slug: string;
  rootDomain: string;
}) {
  const reduced = useReducedMotion();
  const [s, setS] = React.useState<State>(initial);
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();
  const steps = ["Your gym", "Prices", "Timings & website", ...(mustChangePassword ? ["Password"] : [])];
  const last = step === steps.length - 1;
  const gym = (patch: Partial<State["gym"]>) => setS((x) => ({ ...x, gym: { ...x.gym, ...patch } }));
  const site = (patch: Partial<State["site"]>) => setS((x) => ({ ...x, site: { ...x.site, ...patch } }));

  const next = () => {
    if (step === 0 && s.gym.name.trim().length < 2) return setErrors({ "gym.name": ["Enter your gym’s name"] });
    setErrors({});
    if (!last) return setStep((v) => v + 1);
    start(async () => {
      if (mustChangePassword && (pw.current || pw.next)) {
        const r = await changePasswordAction(pw);
        if (!r.ok) {
          setErrors(Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([k, v]) => [`pw.${k}`, v])));
          return void notify.error(r.error);
        }
      }
      const r = await completeOnboardingAction({
        gym: { ...s.gym, city: s.gym.city || undefined, address: s.gym.address || undefined, phone: s.gym.phone || undefined, gstin: s.gym.gstin || undefined },
        plans: s.plans.map((p) => ({ id: p.id, price: p.price, active: p.active })),
        site: s.site,
      });
      if (!r.ok) {
        const fe = r.fieldErrors ?? {};
        setErrors(fe);
        if (Object.keys(fe).some((k) => k.startsWith("gym."))) setStep(0);
        return void notify.error(r.error);
      }
      notify.success("Your gym is ready");
      window.location.assign("/dashboard"); // full load so the workspace picks up the new colour and prefs
    });
  };

  return (
    <div className="min-h-dvh bg-canvas" style={{ "--primary": s.gym.brandColor, "--ring": s.gym.brandColor } as React.CSSProperties}>
      <div className="mx-auto grid min-h-dvh max-w-[1100px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14 lg:py-14">
        <aside className="lg:sticky lg:top-14 lg:self-start">
          <Logo />
          <h1 className="mt-10 font-display text-3xl font-bold tracking-tight">Welcome, {ownerName.split(" ")[0]}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Five minutes to set up your gym. You can change any of this later in Settings.</p>
          <ol className="mt-8 grid gap-1">
            {steps.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    i === step ? "bg-card font-semibold shadow-[var(--shadow-card)]" : "text-muted-foreground",
                    i < step && "hover:bg-card/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                      i < step && "border-primary bg-primary text-primary-foreground",
                      i === step && "border-primary text-primary",
                    )}
                  >
                    {i < step ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="surface min-w-0 self-start p-6 sm:p-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <section className="grid gap-5 sm:grid-cols-2">
                  <Header title="Your gym" body="This appears on invoices, member messages and your website." />
                  <Field label="Gym name" required error={errors["gym.name"]} className="sm:col-span-2">
                    <Input value={s.gym.name} maxLength={128} onChange={(e) => gym({ name: e.target.value })} />
                  </Field>
                  <Field label="City" error={errors["gym.city"]}>
                    <Input value={s.gym.city} maxLength={64} placeholder="Visakhapatnam" onChange={(e) => gym({ city: e.target.value })} />
                  </Field>
                  <Field label="Gym phone" optional hint="Members reach you here on WhatsApp." error={errors["gym.phone"]}>
                    <AffixInput leading="+91" inputMode="tel" value={s.gym.phone} placeholder="98765 43210" onChange={(e) => gym({ phone: e.target.value })} />
                  </Field>
                  <Field label="Address" optional className="sm:col-span-2" error={errors["gym.address"]}>
                    <Input
                      value={s.gym.address}
                      maxLength={500}
                      placeholder="Floor, building, street, area"
                      onChange={(e) => gym({ address: e.target.value })}
                    />
                  </Field>
                  <Field label="GSTIN" optional hint="Needed for GST invoices. You can add it later." className="sm:col-span-2" error={errors["gym.gstin"]}>
                    <Input
                      value={s.gym.gstin}
                      maxLength={15}
                      placeholder="37ABCDE1234F1Z5"
                      className="font-mono uppercase"
                      onChange={(e) => gym({ gstin: e.target.value.toUpperCase() })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium">Brand colour</p>
                    <p className="text-xs text-muted-foreground">Used across your dashboard and website. This page is already using it.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Use colour ${c}`}
                          aria-pressed={s.gym.brandColor.toLowerCase() === c}
                          onClick={() => gym({ brandColor: c })}
                          className="grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow aria-pressed:ring-2 aria-pressed:ring-foreground"
                          style={{ background: c }}
                        >
                          {s.gym.brandColor.toLowerCase() === c && <Check className="size-4 text-white" />}
                        </button>
                      ))}
                      <label className="ml-1 flex h-9 items-center gap-2 rounded-full border px-3 text-sm">
                        <input
                          type="color"
                          value={s.gym.brandColor}
                          onChange={(e) => gym({ brandColor: e.target.value })}
                          className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                          aria-label="Custom colour"
                        />
                        Custom
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {step === 1 && (
                <section>
                  <Header title="Prices" body="We added the plans most gyms start with. Change the prices, and switch off any you don’t sell." />
                  <ul className="mt-6 divide-y rounded-xl border">
                    {s.plans.map((p, i) => (
                      <li key={p.id} className={cn("flex items-center gap-3 px-4 py-3", !p.active && "opacity-55")}>
                        <Switch
                          checked={p.active}
                          aria-label={`Offer ${p.name}`}
                          onCheckedChange={(v) => setS((x) => ({ ...x, plans: x.plans.map((q, n) => (n === i ? { ...q, active: v } : q)) }))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          {!p.name.includes(String(p.sessions || "~")) && <span className="text-xs text-muted-foreground">{planLength(p)}</span>}
                        </span>
                        <AffixInput
                          leading="₹"
                          inputMode="numeric"
                          aria-label={`Price for ${p.name}`}
                          className="w-32"
                          disabled={!p.active}
                          value={String(p.price)}
                          onChange={(e) => {
                            const price = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setS((x) => ({ ...x, plans: x.plans.map((q, n) => (n === i ? { ...q, price } : q)) }));
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">Need a different plan, like a couples or student pack? Add it from Plans after setup.</p>
                </section>
              )}

              {step === 2 && (
                <section className="grid gap-5">
                  <Header title="Timings & website" body={`Your website is at ${slug}.${rootDomain}. It goes live when you finish.`} />
                  <div>
                    <p className="text-sm font-medium">Opening hours</p>
                    <div className="mt-2 grid gap-2">
                      {s.site.hours.map((row, i) => (
                        <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_96px_36px] items-center gap-2">
                          <Input
                            aria-label="Days"
                            value={row.days}
                            maxLength={32}
                            placeholder="Mon – Sat"
                            onChange={(e) => site({ hours: s.site.hours.map((h, n) => (n === i ? { ...h, days: e.target.value } : h)) })}
                          />
                          <Input
                            aria-label="Opens"
                            type="time"
                            value={row.open}
                            onChange={(e) => site({ hours: s.site.hours.map((h, n) => (n === i ? { ...h, open: e.target.value } : h)) })}
                          />
                          <Input
                            aria-label="Closes"
                            type="time"
                            value={row.close}
                            onChange={(e) => site({ hours: s.site.hours.map((h, n) => (n === i ? { ...h, close: e.target.value } : h)) })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove row"
                            onClick={() => site({ hours: s.site.hours.filter((_, n) => n !== i) })}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {s.site.hours.length < 7 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => site({ hours: [...s.site.hours, { days: "Sunday", open: "06:00", close: "12:00" }] })}
                      >
                        <Plus /> Add a row
                      </Button>
                    )}
                  </div>
                  <Field label="Website headline" hint="Short and punchy — it’s shown in large capitals.">
                    <Input value={s.site.tagline} maxLength={60} placeholder="Train hard. Train right." onChange={(e) => site({ tagline: e.target.value })} />
                  </Field>
                  <Field label="Supporting line" optional>
                    <Textarea rows={2} maxLength={220} value={s.site.heroText} onChange={(e) => site({ heroText: e.target.value })} />
                  </Field>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Toggle label="Show prices on the website" checked={s.site.showPrices} onChange={(v) => site({ showPrices: v })} />
                    <Toggle label="Let visitors book a free trial" checked={s.site.showTrial} onChange={(v) => site({ showTrial: v })} />
                  </div>
                </section>
              )}

              {step === 3 && mustChangePassword && (
                <section className="grid gap-5">
                  <Header title="Choose your password" body="Replace the one-time password from your welcome email with one only you know." />
                  <Field label="One-time password" error={errors["pw.current"]}>
                    <Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                  </Field>
                  <Field label="New password" hint="At least 10 characters, with upper and lower case letters and a number." error={errors["pw.next"]}>
                    <Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  </Field>
                  <Field label="Confirm new password" error={errors["pw.confirm"]}>
                    <Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                  </Field>
                  <p className="text-xs text-muted-foreground">Leave these blank to do it later from Settings.</p>
                </section>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-9 flex items-center justify-between gap-3 border-t pt-6">
            <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep((v) => v - 1)}>
              <ArrowLeft /> Back
            </Button>
            <Button type="button" size="lg" loading={pending} onClick={next}>
              {last ? "Finish and open my dashboard" : "Continue"}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

function Header({ title, body }: { title: string; body: string }) {
  return (
    <div className="sm:col-span-2">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
