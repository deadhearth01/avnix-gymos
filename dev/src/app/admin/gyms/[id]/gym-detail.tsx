"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Building2,
  Check,
  CircleCheck,
  Clock,
  CreditCard,
  Globe,
  KeyRound,
  LayoutDashboard,
  Link,
  Loader2,
  MessageCircle,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { TabsBar, useTabParam } from "@/components/kit/tabs-bar";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { Field, AffixInput } from "@/components/forms/field";
import { StatusDot, Tag, type Tone } from "@/components/kit/badges";
import { BrandMark } from "@/components/shell/sidebar";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { useConfirm } from "@/components/kit/confirm";
import { notify } from "@/lib/notify";
import { ago, fmtDate, inr, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  attachSubdomainAction,
  connectDomainAction,
  disconnectDomainAction,
  openWorkspaceAction,
  refreshDomainAction,
  resetOwnerPasswordAction,
  setGymStatusAction,
  setPlatformInvoiceStatusAction,
  toggleCustomDomainAction,
  updateGymProfileAction,
  updateMessagingAction,
  updateSubscriptionAction,
  validateTwilioServiceAction,
} from "../../actions";
import { CopyButton, CredentialsReveal, type RevealData } from "../credentials-reveal";

type GymInfo = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  gstin: string | null;
  brandColor: string | null;
  status: "active" | "suspended" | "archived";
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  createdAt: string;
  customDomainEnabled: boolean;
  customDomain: string | null;
  customDomainStatus: "none" | "pending" | "verified" | "failed";
  twilioSmsServiceSid: string | null;
  twilioWhatsappFrom: string | null;
  twilioWhatsappServiceSid: string | null;
  messagingEnabled: boolean;
  autoSend: boolean;
};
type Sub = {
  planName: string;
  setupFee: number;
  setupFeeStatus: "due" | "paid" | "waived";
  monthlyFee: number;
  billingMonths: number;
  billingStartAt: string | null;
  nextBillingAt: string | null;
  status: "trial" | "active" | "paused" | "cancelled" | "completed";
  gstRate: number;
  graceDays: number;
  autoSuspend: boolean;
  notes: string | null;
};
type Inv = {
  id: string;
  number: string;
  kind: "setup" | "monthly" | "other";
  sequence: number;
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
type Rule = { domain: string; status: string; logs: string } | null;

const TABS = ["overview", "billing", "access", "website", "messaging"] as const;
type Tab = (typeof TABS)[number];

const INV_TONE: Record<Inv["status"], Tone> = { paid: "lime", due: "amber", overdue: "red", waived: "gray", void: "gray" };

export function GymDetail(props: {
  initialTab: string;
  dns: { cname: string; a: string };
  subdomain: string;
  gym: GymInfo;
  sub: Sub | null;
  invoices: Inv[];
  staff: { id: string; userId: string; name: string; email: string; roles: string[]; joined: string; confirm: boolean }[];
  members: { total: number; active: number };
  owner: { name: string; email: string; lastSeen: string; status: boolean; mfa: boolean } | null;
  subdomainRule: Rule;
  customRule: Rule;
}) {
  const { gym } = props;
  const [tab, setTab] = useTabParam<Tab>((TABS as readonly string[]).includes(props.initialTab) ? (props.initialTab as Tab) : "overview", TABS);
  const outstanding = props.invoices.filter((i) => i.status === "due" || i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const siteHost = gym.customDomainEnabled && gym.customDomainStatus === "verified" && gym.customDomain ? gym.customDomain : props.subdomain;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Console", href: "/admin" }, { label: "Gyms", href: "/admin/gyms" }, { label: gym.name }]}
        title={
          <span className="flex items-center gap-3">
            <BrandMark name={gym.name} color={gym.brandColor} size={40} />
            <span className="min-w-0">
              <span className="block truncate">{gym.name}</span>
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusDot tone={gym.status === "active" ? "green" : "red"} pulse={gym.status === "active"}>
              {gym.status === "active" ? "Live" : "Access paused"}
            </StatusDot>
            <a href={`https://${siteHost}`} target="_blank" rel="noreferrer" className="anim-host inline-flex items-center gap-1 hover:text-foreground">
              {siteHost} <AnimatedIcon icon={ArrowUpRight} className="size-3.5" />
            </a>
            <span>Created {fmtDate(gym.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <form action={openWorkspaceAction.bind(null, gym.id)}>
              <Button variant="outline" type="submit">
                <AnimatedIcon icon={LayoutDashboard} /> Open workspace
              </Button>
            </form>
            <AccessToggle key={gym.status} gym={gym} />
          </>
        }
      />

      <TabsBar
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: "overview", label: "Overview", icon: Building2 },
          {
            value: "billing",
            label: "Billing",
            icon: CreditCard,
            badge:
              outstanding > 0 ? (
                <Tag tone="red" className="h-5 px-1.5 text-[11px]">
                  {inr(outstanding)}
                </Tag>
              ) : undefined,
          },
          { value: "access", label: "Access & login", icon: ShieldCheck },
          { value: "website", label: "Website & domain", icon: Globe },
          { value: "messaging", label: "SMS & WhatsApp", icon: MessageCircle },
        ]}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "overview" && <OverviewTab {...props} outstanding={outstanding} />}
          {tab === "billing" && <BillingTab gymId={gym.id} sub={props.sub} invoices={props.invoices} />}
          {tab === "access" && <AccessTab {...props} />}
          {tab === "website" && (
            <WebsiteTab gym={gym} subdomain={props.subdomain} dns={props.dns} subdomainRule={props.subdomainRule} customRule={props.customRule} />
          )}
          {tab === "messaging" && <MessagingTab gym={gym} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/* ───────────── access toggle (header) ───────────── */
function AccessToggle({ gym }: { gym: GymInfo }) {
  const [on, setOn] = React.useState(gym.status === "active");
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  return (
    <label
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-[10px] border px-3 text-sm font-medium shadow-[var(--shadow-card)] transition-colors",
        on ? "bg-success-soft/50" : "bg-danger-soft/50",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Power className={cn("size-4", on ? "text-success-ink" : "text-danger-ink")} />}
      {on ? "Access on" : "Access off"}
      <Switch
        checked={on}
        disabled={pending}
        onCheckedChange={async (v) => {
          if (!v) {
            const ok = await confirm({
              title: `Pause access for ${gym.name}?`,
              description: "Staff will be signed out and see a 'paused' screen until you turn access back on. Their data and website stay intact.",
              confirmLabel: "Pause access",
              destructive: true,
            });
            if (!ok) return;
          }
          setOn(v);
          start(async () => {
            const r = await setGymStatusAction(gym.id, v ? "active" : "suspended");
            if (!r.ok) {
              setOn(!v);
              notify.error(r.error);
            } else {
              notify.success(r.message ?? "Saved");
              router.refresh();
            }
          });
        }}
      />
    </label>
  );
}

/* ───────────── overview ───────────── */
function OverviewTab({
  gym,
  members,
  owner,
  sub,
  outstanding,
}: {
  gym: GymInfo;
  members: { total: number; active: number };
  owner: { name: string; email: string; lastSeen: string } | null;
  sub: Sub | null;
  outstanding: number;
}) {
  const [f, setF] = React.useState({
    name: gym.name,
    city: gym.city ?? "",
    address: gym.address ?? "",
    phone: gym.phone ?? "",
    ownerName: gym.ownerName ?? "",
    ownerPhone: gym.ownerPhone ?? "",
  });
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const dirty =
    JSON.stringify(f) !==
    JSON.stringify({
      name: gym.name,
      city: gym.city ?? "",
      address: gym.address ?? "",
      phone: gym.phone ?? "",
      ownerName: gym.ownerName ?? "",
      ownerPhone: gym.ownerPhone ?? "",
    });
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="grid content-start gap-3 sm:grid-cols-2">
        <MiniStat icon={UsersRound} label="Members" value={num(members.total)} hint={`${num(members.active)} active`} />
        <MiniStat
          icon={Wallet}
          label="Plan"
          value={sub ? `${inr(sub.monthlyFee)}/mo` : "—"}
          hint={sub ? `${sub.planName} · ${sub.billingMonths ? `${sub.billingMonths} months` : "ongoing"}` : "No subscription"}
        />
        <MiniStat
          icon={CreditCard}
          label="Outstanding"
          value={inr(outstanding)}
          hint={outstanding ? "Needs collection" : "All clear"}
          tone={outstanding ? "red" : "lime"}
        />
        <MiniStat icon={Clock} label="Owner last active" value={owner?.lastSeen ? ago(owner.lastSeen) : "Never"} hint={owner?.email ?? "—"} />
      </div>
      <form
        className="surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateGymProfileAction(gym.id, f);
            if (r.ok) {
              notify.success(r.message ?? "Saved");
              router.refresh();
            } else notify.error(r.error);
          });
        }}
      >
        <SectionTitle>Gym details</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gym name" className="sm:col-span-2">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="City">
            <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </Field>
          <Field label="Gym phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="Owner name">
            <Input value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} />
          </Field>
          <Field label="Owner phone">
            <Input value={f.ownerPhone} onChange={(e) => setF({ ...f, ownerPhone: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={pending} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}

function MiniStat({ icon, label, value, hint, tone }: { icon: typeof Wallet; label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="surface anim-host p-4">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <AnimatedIcon icon={icon} className="size-4" /> {label}
      </div>
      <p className={cn("tabular mt-2 text-xl font-semibold tracking-tight", tone === "red" && "text-danger-ink")}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ───────────── billing ───────────── */
function BillingTab({ gymId, sub, invoices }: { gymId: string; sub: Sub | null; invoices: Inv[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = React.useTransition();
  const [payFor, setPayFor] = React.useState<Inv | null>(null);
  const [f, setF] = React.useState({
    planName: sub?.planName ?? "Growth",
    setupFee: String(sub?.setupFee ?? 0),
    setupFeeStatus: sub?.setupFeeStatus ?? "due",
    monthlyFee: String(sub?.monthlyFee ?? 0),
    billingMonths: String(sub?.billingMonths ?? 12),
    billingStartAt: (sub?.billingStartAt ?? new Date().toISOString()).slice(0, 10),
    status: sub?.status ?? "active",
    gstRate: String(sub?.gstRate ?? 18),
    graceDays: String(sub?.graceDays ?? 7),
    autoSuspend: sub?.autoSuspend ?? false,
    notes: sub?.notes ?? "",
  });

  const billedMonths = invoices.filter((i) => i.kind === "monthly" && i.status !== "void").length;
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const due = invoices.filter((i) => i.status === "due" || i.status === "overdue").reduce((s, i) => s + i.total, 0);

  const act = (inv: Inv, status: "waived" | "void" | "due") =>
    start(async () => {
      if (status !== "due") {
        const ok = await confirm({
          title: `${status === "void" ? "Void" : "Waive"} ${inv.number}?`,
          description: status === "void" ? "The invoice is cancelled and excluded from totals." : "The amount is forgiven and won't be collected.",
          confirmLabel: status === "void" ? "Void invoice" : "Waive",
          destructive: true,
        });
        if (!ok) return;
      }
      const r = await setPlatformInvoiceStatusAction(inv.id, status);
      if (r.ok) {
        notify.success(r.message ?? "Updated");
        router.refresh();
      } else notify.error(r.error);
    });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="surface overflow-hidden">
        <div className="grid grid-cols-3 divide-x border-b">
          <Kpi label="Collected" value={inr(paid)} />
          <Kpi label="Outstanding" value={inr(due)} tone={due ? "red" : undefined} />
          <Kpi
            label="Months billed"
            value={`${billedMonths}${sub?.billingMonths ? ` / ${sub.billingMonths}` : ""}`}
            hint={sub?.nextBillingAt ? `Next ${fmtDate(sub.nextBillingAt)}` : sub?.status === "completed" ? "Completed" : undefined}
          />
        </div>
        {invoices.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y">
            {invoices.map((inv, i) => (
              <motion.li
                key={inv.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    inv.kind === "setup" ? "bg-violet-soft text-violet-ink" : "bg-muted text-muted-foreground",
                  )}
                >
                  {inv.kind === "setup" ? <KeyRound className="size-4" /> : <CreditCard className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {inv.number} ·{" "}
                    {inv.status === "paid" ? `paid ${fmtDate(inv.paidAt)}${inv.method ? ` via ${inv.method}` : ""}` : `due ${fmtDate(inv.dueAt)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-semibold">{inr(inv.total)}</p>
                  <p className="tabular text-[11px] text-muted-foreground">incl. {inr(inv.tax)} GST</p>
                </div>
                <Tag tone={INV_TONE[inv.status]} className="hidden w-20 justify-center capitalize sm:inline-flex">
                  {inv.status}
                </Tag>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Invoice actions" disabled={pending}>
                      <span className="text-lg leading-none">⋯</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {inv.status !== "paid" && (
                      <DropdownMenuItem onSelect={() => setPayFor(inv)}>
                        <CircleCheck className="size-4" /> Mark as paid
                      </DropdownMenuItem>
                    )}
                    {(inv.status === "due" || inv.status === "overdue") && <DropdownMenuItem onSelect={() => act(inv, "waived")}>Waive</DropdownMenuItem>}
                    {inv.status !== "due" && inv.status !== "overdue" && <DropdownMenuItem onSelect={() => act(inv, "due")}>Reopen as due</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    {inv.status !== "void" && (
                      <DropdownMenuItem variant="destructive" onSelect={() => act(inv, "void")}>
                        <Trash2 className="size-4" /> Void
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateSubscriptionAction(gymId, { ...f });
            if (r.ok) {
              notify.success(r.message ?? "Saved");
              router.refresh();
            } else notify.error(r.error);
          });
        }}
      >
        <SectionTitle>Subscription</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan name">
            <Input value={f.planName} onChange={(e) => setF({ ...f, planName: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Sub["status"] })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["trial", "active", "paused", "cancelled", "completed"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Initial setup fee">
            <AffixInput leading="₹" value={f.setupFee} onChange={(e) => setF({ ...f, setupFee: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" />
          </Field>
          <Field label="Setup fee status">
            <Select value={f.setupFeeStatus} onValueChange={(v) => setF({ ...f, setupFeeStatus: v as Sub["setupFeeStatus"] })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="waived">Waived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Monthly maintenance & service">
            <AffixInput
              leading="₹"
              trailing="/mo"
              value={f.monthlyFee}
              onChange={(e) => setF({ ...f, monthlyFee: e.target.value.replace(/[^\d.]/g, "") })}
              inputMode="decimal"
            />
          </Field>
          <Field label="Bill for" hint="0 = until cancelled">
            <AffixInput
              trailing="months"
              value={f.billingMonths}
              onChange={(e) => setF({ ...f, billingMonths: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              inputMode="numeric"
            />
          </Field>
          <Field label="Billing started">
            <Input type="date" value={f.billingStartAt} onChange={(e) => setF({ ...f, billingStartAt: e.target.value })} />
          </Field>
          <Field label="GST">
            <AffixInput trailing="%" value={f.gstRate} onChange={(e) => setF({ ...f, gstRate: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" />
          </Field>
          <Field label="Grace period">
            <AffixInput
              trailing="days"
              value={f.graceDays}
              onChange={(e) => setF({ ...f, graceDays: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              inputMode="numeric"
            />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
            <span className="text-sm">Auto-pause when overdue</span>
            <Switch checked={f.autoSuspend} onCheckedChange={(v) => setF({ ...f, autoSuspend: v })} />
          </label>
          <Field label="Internal notes" className="sm:col-span-2">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Discount agreed, payment terms, contacts…" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={pending}>
            Save & sync invoices
          </Button>
        </div>
      </form>

      <MarkPaidDialog key={payFor?.id ?? "none"} inv={payFor} onClose={() => setPayFor(null)} onDone={() => router.refresh()} />
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" }) {
  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-lg font-semibold", tone === "red" && "text-danger-ink")}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MarkPaidDialog({ inv, onClose, onDone }: { inv: Inv | null; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = React.useState("upi");
  const [reference, setReference] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={!!inv} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          {inv?.number} · {inv && inr(inv.total)}
        </DialogDescription>
        <div className="mt-2 grid gap-4">
          <Field label="Method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference" optional hint="UTR / transaction id">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 4287 1122 9981" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              inv &&
              start(async () => {
                const r = await setPlatformInvoiceStatusAction(inv.id, "paid", { method, reference });
                if (r.ok) {
                  notify.success(`${inv.number} marked paid`);
                  onClose();
                  onDone();
                } else notify.error(r.error);
              })
            }
          >
            <Check /> Mark paid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── access ───────────── */
function AccessTab({
  gym,
  owner,
  staff,
}: {
  gym: GymInfo;
  owner: { name: string; email: string; lastSeen: string; status: boolean; mfa: boolean } | null;
  staff: { id: string; name: string; email: string; roles: string[]; joined: string }[];
}) {
  const [reveal, setReveal] = React.useState<RevealData | null>(null);
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface p-5">
        <SectionTitle>Owner login</SectionTitle>
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <PersonAvatar name={owner?.name ?? gym.ownerName ?? "Owner"} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{owner?.name ?? gym.ownerName}</p>
            <p className="truncate text-sm text-muted-foreground">{owner?.email ?? gym.ownerEmail}</p>
          </div>
          <CopyButton value={owner?.email ?? gym.ownerEmail ?? ""} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Last active</dt>
            <dd>{owner?.lastSeen ? ago(owner.lastSeen) : "Never signed in"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Account</dt>
            <dd>{owner?.status === false ? "Blocked" : "Active"}</dd>
          </div>
        </dl>
        <div className="mt-5 rounded-xl border border-dashed p-4">
          <p className="text-sm font-medium">Reset password</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generates a new strong password, signs the owner out everywhere and shows it to you once so you can copy or email it.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            loading={pending}
            onClick={async () => {
              const ok = await confirm({
                title: "Reset the owner's password?",
                description: "Their current password stops working immediately and all sessions are signed out.",
                confirmLabel: "Reset password",
                destructive: true,
              });
              if (!ok) return;
              start(async () => {
                const r = await resetOwnerPasswordAction(gym.id);
                if (!r.ok) {
                  notify.error(r.error);
                  return;
                }
                const d = r.data!;
                setReveal({
                  allowEmail: true,
                  gymId: gym.id,
                  gymName: d.gymName,
                  email: d.email,
                  password: d.password,
                  loginUrl: `${window.location.origin}/login`,
                  note: "New password generated. Copy it or email it — it's shown only once.",
                });
              });
            }}
          >
            <AnimatedIcon icon={KeyRound} /> Generate new password
          </Button>
        </div>
      </div>

      <div className="surface p-5">
        <SectionTitle>Team ({staff.length})</SectionTitle>
        <ul className="flex flex-col gap-1">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
              <PersonAvatar name={s.name || s.email} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name || s.email}</p>
                <p className="truncate text-xs text-muted-foreground">{s.email}</p>
              </div>
              <Tag tone={s.roles.includes("owner") ? "violet" : "gray"} className="capitalize">
                {s.roles.join(", ")}
              </Tag>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          The owner can add managers, front-desk staff and trainers from their dashboard under Staff.
        </p>
      </div>
      <CredentialsReveal data={reveal} open={!!reveal} onOpenChange={(v) => !v && setReveal(null)} />
    </div>
  );
}

/* ───────────── website & domain ───────────── */
function RuleBadge({ status }: { status: string | undefined }) {
  if (status === "verified")
    return (
      <Tag tone="lime">
        <CircleCheck className="size-3.5" /> Live · SSL active
      </Tag>
    );
  if (status === "verifying")
    return (
      <Tag tone="blue">
        <Loader2 className="size-3.5 animate-spin" /> Issuing certificate
      </Tag>
    );
  if (status === "failed")
    return (
      <Tag tone="red">
        <TriangleAlert className="size-3.5" /> Check DNS
      </Tag>
    );
  return (
    <Tag tone="amber">
      <Clock className="size-3.5" /> Waiting for DNS
    </Tag>
  );
}

function WebsiteTab({
  gym,
  subdomain,
  dns,
  subdomainRule,
  customRule,
}: {
  gym: GymInfo;
  subdomain: string;
  dns: { cname: string; a: string };
  subdomainRule: Rule;
  customRule: Rule;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = React.useTransition();
  const [enabled, setEnabled] = React.useState(gym.customDomainEnabled);
  const [domain, setDomain] = React.useState(gym.customDomain ?? "");
  const [logs, setLogs] = React.useState(customRule?.logs ?? "");
  const connected = !!gym.customDomain;
  const isApex = domain.split(".").length === 2 || (domain.endsWith(".co.in") && domain.split(".").length === 3);
  const host = domain.split(".")[0];

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; data?: unknown }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) notify.success(r.message);
        router.refresh();
      } else notify.error(r.error ?? "Failed");
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface p-5">
        <SectionTitle action={<RuleBadge status={subdomainRule?.status} />}>Built-in website address</SectionTitle>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3">
          <Globe className="size-4 text-muted-foreground" />
          <a href={`https://${subdomain}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
            {subdomain}
          </a>
          <CopyButton value={`https://${subdomain}`} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Every gym gets this automatically. It&apos;s served by the Appwrite Site with a free TLS certificate once{" "}
          <code className="rounded bg-muted px-1 text-xs">*.{subdomain.split(".").slice(1).join(".")}</code> points to your Appwrite server.
        </p>
        <Button variant="outline" size="sm" className="mt-4" loading={pending} onClick={() => run(() => attachSubdomainAction(gym.id))}>
          <AnimatedIcon icon={RefreshCw} /> Re-check
        </Button>
        {subdomainRule?.logs && (
          <pre className="mt-3 max-h-40 scrollbar-thin overflow-auto rounded-xl bg-muted/60 p-3 text-[11px] whitespace-pre-wrap text-muted-foreground">
            {subdomainRule.logs}
          </pre>
        )}
      </div>

      <div className="surface p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Custom domain</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Use the gym&apos;s own domain, e.g. www.ironparadise.in. Falls back to the built-in address when off.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              if (connected) run(() => toggleCustomDomainAction(gym.id, v));
            }}
          />
        </div>
        <AnimatePresence initial={false}>
          {enabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-1">
                <AffixInput
                  leading={<Link className="size-4" />}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
                  placeholder="www.yourgym.in"
                  className="flex-1"
                />
                <Button
                  loading={pending}
                  onClick={() => run(() => connectDomainAction(gym.id, domain))}
                  disabled={!domain || (connected && domain === gym.customDomain)}
                >
                  {connected ? "Update" : "Connect"}
                </Button>
              </div>

              {connected && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{gym.customDomain}</p>
                    <div className="mt-1">
                      <RuleBadge
                        status={gym.customDomainStatus === "verified" ? "verified" : gym.customDomainStatus === "failed" ? "failed" : customRule?.status}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      loading={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await refreshDomainAction(gym.id);
                          if (r.ok) {
                            setLogs(r.data?.logs ?? "");
                            notify[r.data?.status === "verified" ? "success" : "info"](
                              r.data?.status === "verified"
                                ? "Domain verified — SSL is being issued"
                                : "Still waiting for DNS. Changes can take up to an hour.",
                            );
                            router.refresh();
                          } else notify.error(r.error);
                        })
                      }
                    >
                      <AnimatedIcon icon={RefreshCw} /> Verify
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove domain"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Remove ${gym.customDomain}?`,
                            description: "The site keeps working on the built-in address.",
                            confirmLabel: "Remove",
                            destructive: true,
                          })
                        )
                          run(() => disconnectDomainAction(gym.id));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-xl border">
                <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Ask the owner to add this DNS record at their domain registrar</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px]">
                    {!isApex || !dns.a ? (
                      <tr className="border-t">
                        <td className="px-3 py-2.5">CNAME</td>
                        <td className="px-3 py-2.5">{domain ? (isApex ? "@" : host) : "www"}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            {dns.cname} <CopyButton value={dns.cname} />
                          </span>
                        </td>
                      </tr>
                    ) : (
                      <tr className="border-t">
                        <td className="px-3 py-2.5">A</td>
                        <td className="px-3 py-2.5">@</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            {dns.a} <CopyButton value={dns.a} />
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Tip: use <b>www</b> with a CNAME, and forward the bare domain to www at the registrar. Remove any old A/AAAA records for that name.
                  Verification + SSL happen automatically.
                </p>
              </div>
              {logs && (
                <pre className="mt-3 max-h-40 scrollbar-thin overflow-auto rounded-xl bg-muted/60 p-3 text-[11px] whitespace-pre-wrap text-muted-foreground">
                  {logs}
                </pre>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────── messaging ───────────── */
function MessagingTab({ gym }: { gym: GymInfo }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState({
    smsServiceSid: gym.twilioSmsServiceSid ?? "",
    whatsappFrom: gym.twilioWhatsappFrom ?? "",
    whatsappServiceSid: gym.twilioWhatsappServiceSid ?? "",
    messagingEnabled: gym.messagingEnabled,
    autoSend: gym.autoSend,
  });
  const [checks, setChecks] = React.useState<Record<string, { ok: boolean; text: string } | undefined>>({});
  const validate = (key: "smsServiceSid" | "whatsappServiceSid") =>
    start(async () => {
      const r = await validateTwilioServiceAction(f[key]);
      setChecks((c) => ({ ...c, [key]: { ok: r.ok, text: r.ok ? `Found: ${r.name}` : (r.error ?? "Not found") } }));
    });

  return (
    <form
      className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateMessagingAction(gym.id, f);
          if (r.ok) {
            notify.success(r.message ?? "Saved");
            router.refresh();
          } else notify.error(r.error);
        });
      }}
    >
      <div className="surface p-5">
        <SectionTitle>Twilio senders</SectionTitle>
        <div className="grid gap-4">
          <Field
            label="SMS Messaging Service SID"
            hint={checks.smsServiceSid?.text ?? "From Twilio → Messaging → Services. Must use DLT-registered templates for India."}
          >
            <div className="flex gap-2">
              <Input
                value={f.smsServiceSid}
                onChange={(e) => setF({ ...f, smsServiceSid: e.target.value.trim() })}
                placeholder="MG…"
                className={cn("font-mono", checks.smsServiceSid && (checks.smsServiceSid.ok ? "border-success/60" : "border-destructive/60"))}
              />
              <Button type="button" variant="outline" disabled={!f.smsServiceSid} onClick={() => validate("smsServiceSid")}>
                Check
              </Button>
            </div>
          </Field>
          <Field label="WhatsApp sender number" hint="An approved WhatsApp sender on the AvniX Twilio account (E.164).">
            <AffixInput
              leading={<MessageCircle className="size-4" />}
              value={f.whatsappFrom}
              onChange={(e) => setF({ ...f, whatsappFrom: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </Field>
          <Field label="WhatsApp Messaging Service SID" optional hint={checks.whatsappServiceSid?.text ?? "If set, it's used instead of the number above."}>
            <div className="flex gap-2">
              <Input
                value={f.whatsappServiceSid}
                onChange={(e) => setF({ ...f, whatsappServiceSid: e.target.value.trim() })}
                placeholder="MG…"
                className="font-mono"
              />
              <Button type="button" variant="outline" disabled={!f.whatsappServiceSid} onClick={() => validate("whatsappServiceSid")}>
                Check
              </Button>
            </div>
          </Field>
        </div>
      </div>
      <div className="surface flex flex-col gap-3 p-5">
        <SectionTitle>Delivery</SectionTitle>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3.5">
          <span>
            <span className="block text-sm font-medium">Messaging enabled</span>
            <span className="block text-xs text-muted-foreground">Allow this gym to send SMS & WhatsApp through AvniX.</span>
          </span>
          <Switch checked={f.messagingEnabled} onCheckedChange={(v) => setF({ ...f, messagingEnabled: v, autoSend: v ? f.autoSend : false })} />
        </label>
        <label className={cn("flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-opacity", !f.messagingEnabled && "opacity-50")}>
          <span>
            <span className="block text-sm font-medium">Send automations automatically</span>
            <span className="block text-xs text-muted-foreground">Off = staff review & tap-to-send from the outbox.</span>
          </span>
          <Switch disabled={!f.messagingEnabled} checked={f.autoSend} onCheckedChange={(v) => setF({ ...f, autoSend: v })} />
        </label>
        <p className="rounded-xl bg-info-soft p-3 text-xs text-info-ink">
          Business-initiated WhatsApp messages outside the 24-hour window need Meta-approved templates. Add their Content SIDs on each automation in the
          gym&apos;s Automations page.
        </p>
        <div className="mt-auto flex justify-end pt-2">
          <Button type="submit" loading={pending}>
            Save messaging
          </Button>
        </div>
      </div>
    </form>
  );
}
