"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, CreditCard, KeyRound, Monitor, Moon, Palette, Settings2, Sun, Upload } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { TabsBar, useTabParam } from "@/components/kit/tabs-bar";
import { FadeIn } from "@/components/kit/motion";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { Field, FormSection, AffixInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { notify } from "@/lib/notify";
import { inr } from "@/lib/format";
import { updateGymSettingsAction, uploadLogoAction, changePasswordAction } from "../_actions/settings";

type GymForm = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  gstin: string;
  gstRate: number;
  gstInclusive: boolean;
  brandColor: string;
  logoUrl: string | null;
};
type Tab = "profile" | "billing" | "security" | "preferences";
const tabs: Tab[] = ["profile", "billing", "security", "preferences"];
const colors = ["#16a34a", "#84cc16", "#2563eb", "#7c3aed", "#ea580c", "#e11d48"];

export function SettingsView({ initialTab, gym }: { initialTab: string; gym: GymForm }) {
  const [tab, setTab] = useTabParam<Tab>(tabs.includes(initialTab as Tab) ? (initialTab as Tab) : "profile", tabs);
  const [f, setF] = React.useState(gym);
  const [saved, setSaved] = React.useState(gym);
  const [logoUrl, setLogoUrl] = React.useState(gym.logoUrl);
  const [dragging, setDragging] = React.useState(false);
  const [saving, startSave] = React.useTransition();
  const [uploading, startUpload] = React.useTransition();
  const router = useRouter();
  const dirty = JSON.stringify({ ...f, logoUrl: null }) !== JSON.stringify({ ...saved, logoUrl: null });
  function save() {
    startSave(async () => {
      const r = await updateGymSettingsAction({
        name: f.name,
        phone: f.phone,
        email: f.email,
        city: f.city,
        address: f.address,
        gstin: f.gstin,
        gstRate: Number(f.gstRate),
        gstInclusive: f.gstInclusive,
        brandColor: f.brandColor,
      });
      if (r.ok) {
        notify.success(r.message ?? "Settings saved");
        setSaved(f);
        router.refresh();
      } else notify.error(r.error);
    });
  }
  function upload(file?: File) {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    startUpload(async () => {
      const r = await uploadLogoAction(data);
      if (r.ok) {
        notify.success(r.message ?? "Logo updated");
        setLogoUrl(URL.createObjectURL(file));
        router.refresh();
      } else notify.error(r.error);
    });
  }
  const taxRate = Number(f.gstRate) || 0;
  const base = f.gstInclusive ? 1500 / (1 + taxRate / 100) : 1500;
  const tax = (base * taxRate) / 100;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Settings" }]}
        title="Settings"
        description="Manage your gym, billing rules, account and experience."
      />
      <TabsBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "profile", label: "Gym profile", icon: Building2 },
          { value: "billing", label: "Billing & GST", icon: CreditCard },
          { value: "security", label: "Security", icon: KeyRound },
          { value: "preferences", label: "Preferences", icon: Settings2 },
        ]}
        layoutId="gym-settings-tabs"
      />
      <FadeIn key={tab} className="mt-5">
        {tab === "profile" && (
          <div className="surface p-5 sm:p-7">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <FormSection title="Gym identity" description="These details appear in your workspace and member communications.">
                <Field label="Gym name" required className="sm:col-span-2">
                  <Input required minLength={2} maxLength={128} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input type="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                </Field>
                <Field label="City">
                  <Input maxLength={64} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
                </Field>
                <Field label="GSTIN" hint="Optional 15-character registration number">
                  <Input maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} className="uppercase" />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Textarea maxLength={500} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
                </Field>
              </FormSection>
              <FormSection title="Brand" description="Use your colour and logo across your gym workspace.">
                <div className="sm:col-span-2">
                  <SectionTitle>Brand colour</SectionTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Use colour ${c}`}
                        aria-pressed={f.brandColor === c}
                        className="size-9 rounded-full border-2 border-white ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground"
                        style={{ background: c }}
                        onClick={() => setF({ ...f, brandColor: c })}
                      />
                    ))}
                    <Input
                      type="color"
                      aria-label="Custom brand colour"
                      className="h-9 w-12 p-1"
                      value={f.brandColor}
                      onChange={(e) => setF({ ...f, brandColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <SectionTitle>Logo</SectionTitle>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div
                      role="img"
                      aria-label={logoUrl ? "Current gym logo" : "No gym logo"}
                      className="grid size-20 shrink-0 place-items-center rounded-2xl border bg-muted/40 bg-cover bg-center text-muted-foreground"
                      style={logoUrl ? { backgroundImage: `url(${logoUrl})` } : undefined}
                    >
                      {!logoUrl && <Palette className="size-6" />}
                    </div>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        upload(e.dataTransfer.files[0]);
                      }}
                      className={`flex min-h-24 flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors ${dragging ? "border-primary bg-success-soft/40" : "border-border hover:bg-muted/40"}`}
                    >
                      <span className="anim-host flex items-center gap-2 text-sm font-medium">
                        <AnimatedIcon icon={Upload} className="size-4" /> {uploading ? "Uploading…" : "Drop a logo here or browse"}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP, AVIF, GIF or SVG · up to 8 MB</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          upload(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </FormSection>
              <div className="flex justify-end pt-5">
                <Button type="submit" loading={saving} disabled={!dirty}>
                  Save profile
                </Button>
              </div>
            </form>
          </div>
        )}
        {tab === "billing" && (
          <div className="surface p-5 sm:p-7">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <FormSection title="GST on memberships" description="Set how tax appears on invoices and plan prices.">
                <Field label="GST rate" required hint="Gym and fitness services: 5%">
                  <AffixInput
                    type="number"
                    min={0}
                    max={28}
                    step="0.01"
                    value={f.gstRate}
                    trailing="%"
                    onChange={(e) => setF({ ...f, gstRate: Number(e.target.value) })}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <Switch id="gst-inclusive" checked={f.gstInclusive} onCheckedChange={(v) => setF({ ...f, gstInclusive: v })} />
                  <label htmlFor="gst-inclusive" className="text-sm">
                    <span className="block font-medium">Prices include GST</span>
                    <span className="text-xs text-muted-foreground">Split tax out of the listed plan price</span>
                  </label>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Live example</p>
                  <p className="mt-1 text-base font-semibold">
                    ₹1,500 plan → taxable {inr(base, true)} + GST {inr(tax, true)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Customer pays {inr(base + tax, true)} with {f.gstInclusive ? "tax included" : "tax added"}.
                  </p>
                </div>
              </FormSection>
              <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-ink">
                SAC 999723 · Gym services attract 5% GST without input tax credit from 22 Sep 2025. GST on expenses remains a cost.
              </div>
              <div className="flex justify-end pt-5">
                <Button type="submit" loading={saving} disabled={!dirty}>
                  Save billing settings
                </Button>
              </div>
            </form>
          </div>
        )}
        {tab === "security" && <SecurityForm />}
        {tab === "preferences" && <Preferences />}
      </FadeIn>
    </>
  );
}

function SecurityForm() {
  const [f, setF] = React.useState({ current: "", next: "", confirm: "" });
  const [pending, start] = React.useTransition();
  const strength = [f.next.length >= 10, /[a-z]/.test(f.next) && /[A-Z]/.test(f.next), /\d/.test(f.next), /[^\w]/.test(f.next)].filter(Boolean).length;
  return (
    <div className="surface max-w-2xl p-5 sm:p-7">
      <SectionTitle>Change password</SectionTitle>
      <p className="mb-5 text-sm text-muted-foreground">Use at least 10 characters with upper and lower case letters and a number.</p>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.next !== f.confirm) {
            notify.error("Passwords don't match");
            return;
          }
          start(async () => {
            const r = await changePasswordAction(f);
            if (r.ok) {
              notify.success(r.message ?? "Password changed");
              setF({ current: "", next: "", confirm: "" });
            } else notify.error(r.error);
          });
        }}
      >
        <Field label="Current password" required>
          <Input type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        </Field>
        <Field label="New password" required>
          <Input type="password" autoComplete="new-password" required minLength={10} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        </Field>
        <div aria-label={`Password strength ${strength} of 4`} className="flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-1.5 flex-1 rounded-full ${strength >= n ? (strength <= 2 ? "bg-warning" : "bg-primary") : "bg-muted"}`} />
          ))}
        </div>
        <Field label="Confirm new password" required>
          <Input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </Field>
        <div className="flex justify-end border-t pt-4">
          <Button type="submit" loading={pending}>
            Change password
          </Button>
        </div>
      </form>
    </div>
  );
}

function Preferences() {
  const { settings, setSettings } = useFeedback();
  const { theme, setTheme } = useTheme();
  return (
    <div className="surface max-w-2xl p-5 sm:p-7">
      <SectionTitle>Feedback</SectionTitle>
      <p className="mb-5 text-sm text-muted-foreground">Choose how the workspace responds to your actions.</p>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="haptics" className="text-sm font-medium">
              Haptics
            </label>
            <p className="text-xs text-muted-foreground">Vibration feedback on supported devices</p>
          </div>
          <Switch id="haptics" checked={settings.haptics} onCheckedChange={(v) => setSettings({ haptics: v })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="sounds" className="text-sm font-medium">
              Sounds
            </label>
            <p className="text-xs text-muted-foreground">Subtle sounds for actions and alerts</p>
          </div>
          <Switch id="sounds" checked={settings.sound} onCheckedChange={(v) => setSettings({ sound: v })} />
        </div>
        <Field label={`Sound volume · ${Math.round(settings.volume * 100)}%`}>
          <Input
            type="range"
            min={0}
            max={1}
            step={0.05}
            disabled={!settings.sound}
            value={settings.volume}
            onChange={(e) => setSettings({ volume: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="mt-7 border-t pt-6">
        <SectionTitle>Appearance</SectionTitle>
        <Field label="Theme">
          <Select value={theme ?? "system"} onValueChange={setTheme}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <span className="flex items-center gap-2">
                  <Sun className="size-4" /> Light
                </span>
              </SelectItem>
              <SelectItem value="dark">
                <span className="flex items-center gap-2">
                  <Moon className="size-4" /> Dark
                </span>
              </SelectItem>
              <SelectItem value="system">
                <span className="flex items-center gap-2">
                  <Monitor className="size-4" /> System
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}
