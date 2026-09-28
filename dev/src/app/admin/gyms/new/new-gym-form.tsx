"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleX, Globe, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection, AffixInput } from "@/components/forms/field";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { BrandMark } from "@/components/shell/sidebar";
import { notify } from "@/lib/notify";
import { inr } from "@/lib/format";
import { slugify } from "@/lib/domain/slug";
import { checkSlugAction, createGymAction, suggestSlugAction, type CreateGymPayload } from "../../actions";
import { CredentialsReveal, type RevealData } from "../credentials-reveal";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gym.avnix.in";
const today = () => new Date().toISOString().slice(0, 10);

type Errors = Record<string, string[] | undefined>;

export function NewGymForm() {
  const router = useRouter();
  const [f, setF] = React.useState({
    name: "",
    slug: "",
    city: "Visakhapatnam",
    address: "",
    phone: "",
    gstin: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    planName: "Growth",
    setupFee: "15000",
    setupFeeStatus: "due" as "due" | "paid" | "waived",
    monthlyFee: "1999",
    billingMonths: "12",
    billingStartAt: today(),
    gstRate: "18",
    autoSuspend: false,
    graceDays: "7",
    smsServiceSid: "",
    whatsappFrom: "",
    whatsappServiceSid: "",
    emailOwner: true,
  });
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugResult, setSlugResult] = React.useState<{ slug: string; available: boolean; error?: string } | null>(null);
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, start] = React.useTransition();
  const [reveal, setReveal] = React.useState<RevealData | null>(null);
  const [created, setCreated] = React.useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  // slug follows the name until the user edits it
  const slug = slugTouched ? f.slug : slugify(f.name);
  const slugState = !slug
    ? { checking: false as const, available: undefined, error: undefined }
    : slugResult?.slug === slug
      ? { checking: false as const, available: slugResult.available, error: slugResult.error }
      : { checking: true as const, available: undefined, error: undefined };

  // live availability (debounced; result is keyed by slug so stale answers are ignored)
  React.useEffect(() => {
    if (!slug) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await checkSlugAction(slug);
      if (alive) setSlugResult({ slug, available: r.available, error: r.error });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [slug]);

  const months = Number(f.billingMonths) || 0;
  const gst = Number(f.gstRate) || 0;
  const setup = f.setupFeeStatus === "waived" ? 0 : Number(f.setupFee) || 0;
  const monthly = Number(f.monthlyFee) || 0;
  const contract = setup + monthly * (months || 12);
  const withTax = contract * (1 + gst / 100);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const payload: CreateGymPayload = {
      name: f.name,
      slug,
      city: f.city,
      address: f.address,
      phone: f.phone,
      gstin: f.gstin,
      owner: { name: f.ownerName, email: f.ownerEmail, phone: f.ownerPhone },
      subscription: {
        planName: f.planName,
        setupFee: f.setupFee,
        setupFeeStatus: f.setupFeeStatus,
        monthlyFee: f.monthlyFee,
        billingMonths: f.billingMonths,
        billingStartAt: f.billingStartAt,
        gstRate: f.gstRate,
        autoSuspend: f.autoSuspend,
        graceDays: f.graceDays,
      },
      twilio: { smsServiceSid: f.smsServiceSid, whatsappFrom: f.whatsappFrom, whatsappServiceSid: f.whatsappServiceSid },
      emailOwner: f.emailOwner,
    };
    start(async () => {
      const r = await createGymAction(payload);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        notify.error(r.error);
        document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const d = r.data!;
      notify.success(`${f.name} is live 🎉`);
      if (d.domainWarning) notify.warning(d.domainWarning);
      if (d.emailError) notify.warning(`Couldn't email the owner: ${d.emailError}`);
      setCreated(d.gymId);
      setReveal({
        allowEmail: true,
        gymId: d.gymId,
        gymName: f.name,
        email: d.credentials.email,
        password: d.credentials.password,
        loginUrl: d.loginUrl,
        siteUrl: d.siteUrl,
        emailed: d.emailed,
        note: d.emailed ? `We've emailed these to ${d.credentials.email}. You can also copy them below — the password is shown only once.` : undefined,
      });
    });
  };

  const err = (k: string) => errors[k];

  return (
    <>
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
        <div className="surface px-5 py-7 sm:px-7">
          <FormSection title="Gym" description="How the gym appears on invoices, its website and in the owner's dashboard.">
            <Field label="Gym name" required error={err("name")} className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Iron Paradise Fitness" autoFocus maxLength={128} />
            </Field>
            <Field
              label="Website address"
              required
              error={err("slug") ?? (slugState.error ? [slugState.error] : undefined)}
              hint={slugState.available ? "Available ✓ — SSL is issued automatically." : "Lowercase letters, numbers and hyphens."}
              className="sm:col-span-2"
            >
              <div className="flex h-10 items-center rounded-[10px] border border-input bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow] focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
                <span className="pl-3 text-sm text-muted-foreground">https://</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set(
                      "slug",
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                        .slice(0, 40),
                    );
                  }}
                  className="h-full min-w-0 flex-1 bg-transparent px-1 text-sm font-medium outline-none"
                  placeholder="ironparadise"
                  aria-label="Subdomain"
                />
                <span className="pr-2 text-sm text-muted-foreground">.{ROOT}</span>
                <span className="grid w-8 place-items-center">
                  <AnimatePresence mode="wait">
                    {slugState.checking ? (
                      <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </motion.span>
                    ) : slugState.available ? (
                      <motion.span
                        key="ok"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="grid size-5 place-items-center rounded-full bg-success text-white"
                      >
                        <Check className="size-3" />
                      </motion.span>
                    ) : slug ? (
                      <motion.span key="x" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <CircleX className="size-4 text-destructive" />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
              </div>
            </Field>
            {slugState.error === "Already taken" && f.name && (
              <button
                type="button"
                className="anim-host -mt-2 inline-flex items-center gap-1.5 text-left text-xs text-primary sm:col-span-2"
                onClick={async () => {
                  setSlugTouched(true);
                  set("slug", await suggestSlugAction(f.name));
                }}
              >
                <AnimatedIcon icon={Sparkles} className="size-3.5" /> Suggest an available address
              </button>
            )}
            <Field label="City" error={err("city")}>
              <Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Visakhapatnam" />
            </Field>
            <Field label="Gym phone" optional error={err("phone")}>
              <AffixInput leading="+91" value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="98765 43210" />
            </Field>
            <Field label="Address" optional error={err("address")} className="sm:col-span-2">
              <Input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Door no, street, area" />
            </Field>
            <Field label="GSTIN" optional error={err("gstin")} hint="Used on member invoices. State code is read from it." className="sm:col-span-2">
              <Input
                value={f.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                placeholder="37ABCDE1234F1Z5"
                maxLength={15}
                className="font-mono uppercase"
              />
            </Field>
          </FormSection>

          <FormSection title="Owner login" description="We create the owner's account with a strong one-time password. They'll be asked to change it.">
            <Field label="Owner name" required error={err("owner.name")}>
              <Input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Ravi Teja" autoComplete="off" />
            </Field>
            <Field label="Owner phone" optional error={err("owner.phone")}>
              <AffixInput leading="+91" value={f.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} inputMode="tel" placeholder="98765 43210" />
            </Field>
            <Field label="Owner email" required error={err("owner.email")} hint="This is their sign-in username." className="sm:col-span-2">
              <Input
                type="email"
                value={f.ownerEmail}
                onChange={(e) => set("ownerEmail", e.target.value)}
                placeholder="owner@ironparadise.in"
                autoComplete="off"
              />
            </Field>
            <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Email login details to the owner</span>
                <span className="block text-xs text-muted-foreground">Sent from noreply.gymos@avnix.in. You&apos;ll still see the password once.</span>
              </span>
              <Switch checked={f.emailOwner} onCheckedChange={(v) => set("emailOwner", v)} />
            </label>
          </FormSection>

          <FormSection title="Subscription & fees" description="What AvniX charges this gym. Invoices are generated automatically every month.">
            <Field label="Plan name" error={err("subscription.planName")}>
              <Input value={f.planName} onChange={(e) => set("planName", e.target.value)} placeholder="Growth" />
            </Field>
            <Field label="Billing starts" required error={err("subscription.billingStartAt")}>
              <Input type="date" value={f.billingStartAt} onChange={(e) => set("billingStartAt", e.target.value)} />
            </Field>
            <Field label="Initial setup fee" error={err("subscription.setupFee")} hint="One-time onboarding, migration & training.">
              <AffixInput leading="₹" value={f.setupFee} onChange={(e) => set("setupFee", e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" />
            </Field>
            <Field label="Setup fee status">
              <Select value={f.setupFeeStatus} onValueChange={(v) => set("setupFeeStatus", v as typeof f.setupFeeStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">Due — invoice it</SelectItem>
                  <SelectItem value="paid">Already paid</SelectItem>
                  <SelectItem value="waived">Waived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Monthly maintenance & service fee" error={err("subscription.monthlyFee")}>
              <AffixInput
                leading="₹"
                trailing="/ month"
                value={f.monthlyFee}
                onChange={(e) => set("monthlyFee", e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
              />
            </Field>
            <Field label="Bill for" error={err("subscription.billingMonths")} hint="0 = keep billing until cancelled.">
              <AffixInput
                trailing="months"
                value={f.billingMonths}
                onChange={(e) => set("billingMonths", e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
              />
            </Field>
            <Field label="GST on AvniX invoices" error={err("subscription.gstRate")}>
              <AffixInput
                trailing="%"
                value={f.gstRate}
                onChange={(e) => set("gstRate", e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                inputMode="decimal"
              />
            </Field>
            <Field label="Grace period" hint="Days after the due date before an invoice is overdue.">
              <AffixInput
                trailing="days"
                value={f.graceDays}
                onChange={(e) => set("graceDays", e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
              />
            </Field>
            <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Auto-pause access when overdue</span>
                <span className="block text-xs text-muted-foreground">
                  If an invoice is unpaid past the grace period, the gym&apos;s dashboard is paused until you re-enable it.
                </span>
              </span>
              <Switch checked={f.autoSuspend} onCheckedChange={(v) => set("autoSuspend", v)} />
            </label>
          </FormSection>

          <FormSection title="SMS & WhatsApp" description="Runs under the AvniX Twilio account. Add this gym's senders now or later from the gym page.">
            <Field
              label="SMS Messaging Service SID"
              optional
              error={err("twilio.smsServiceSid")}
              hint="Starts with MG… (DLT-registered sender)"
              className="sm:col-span-2"
            >
              <Input
                value={f.smsServiceSid}
                onChange={(e) => set("smsServiceSid", e.target.value.trim())}
                placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono"
              />
            </Field>
            <Field label="WhatsApp sender number" optional error={err("twilio.whatsappFrom")} hint="An approved WhatsApp number on the AvniX account.">
              <AffixInput
                leading={<MessageCircle className="size-4" />}
                value={f.whatsappFrom}
                onChange={(e) => set("whatsappFrom", e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
              />
            </Field>
            <Field label="…or WhatsApp Messaging Service SID" optional error={err("twilio.whatsappServiceSid")}>
              <Input value={f.whatsappServiceSid} onChange={(e) => set("whatsappServiceSid", e.target.value.trim())} placeholder="MG…" className="font-mono" />
            </Field>
          </FormSection>
        </div>

        {/* Summary rail */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_60%)] p-5">
              <div className="flex items-center gap-3">
                <BrandMark name={f.name || "G"} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{f.name || "New gym"}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Globe className="size-3" /> {slug || "your-gym"}.{ROOT}
                  </p>
                </div>
              </div>
            </div>
            <dl className="flex flex-col gap-2.5 p-5 text-sm">
              <SummaryRow
                label="Setup fee"
                value={f.setupFeeStatus === "waived" ? "Waived" : `${inr(Number(f.setupFee) || 0)}${f.setupFeeStatus === "paid" ? " · paid" : ""}`}
              />
              <SummaryRow label="Monthly fee" value={`${inr(monthly)} × ${months || "∞"}`} />
              <SummaryRow label="Contract value" value={inr(contract)} hint={months ? undefined : "first 12 months"} />
              <SummaryRow label={`With ${gst}% GST`} value={inr(withTax)} strong />
            </dl>
            <div className="border-t p-5">
              <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!slugState.available && !!slug}>
                Create gym &amp; login <AnimatedIcon icon={ArrowRight} />
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Creates the owner account, team, starter plans, automations, website and invoices.
              </p>
              <AnimatePresence>
                {created && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/admin/gyms/${created}`}>Open gym</Link>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>
      </form>
      <CredentialsReveal
        data={reveal}
        open={!!reveal}
        onOpenChange={(v) => {
          if (!v) {
            setReveal(null);
            if (created) router.push(`/admin/gyms/${created}`);
          }
        }}
      />
    </>
  );
}

function SummaryRow({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-xs text-subtle">({hint})</span>}
      </dt>
      <dd className={strong ? "tabular text-base font-semibold" : "tabular font-medium"}>{value}</dd>
    </div>
  );
}
