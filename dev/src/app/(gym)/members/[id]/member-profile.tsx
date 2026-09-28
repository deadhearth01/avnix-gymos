"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  CalendarClock,
  CreditCard,
  Dumbbell,
  Flame,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Play,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Snowflake,
  Target,
  TrendingUp,
  Undo2,
  Wallet,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, SectionTitle } from "@/components/kit/page-header";
import { TabsBar } from "@/components/kit/tabs-bar";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { StatusDot, Tag, type Tone } from "@/components/kit/badges";
import { DotHeatmap } from "@/components/charts/dot-heatmap";
import { Field, AffixInput } from "@/components/forms/field";
import { Segmented } from "@/components/kit/segmented";
import { useConfirm } from "@/components/kit/confirm";
import { MemberCard } from "@/components/gym/member-card";
import { PlanSaleFields, initialSale, saleTotals, type PlanOption, type SaleState } from "@/components/gym/plan-sale";
import { STATUS_META, type LiveStatus } from "@/lib/domain/membership";
import { PLAYBOOK_BY_KEY, type PlaybookKey } from "@/lib/domain/playbooks";
import { ago, fmtDate, fmtDateTime, fmtPhone, inr } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { freezeMemberAction, setMemberArchivedAction, unfreezeMemberAction, updateMemberAction } from "../../_actions/members";
import { recordPaymentAction, sellMembershipAction, voidInvoiceAction } from "../../_actions/billing";
import { checkInAction } from "../../_actions/frontdesk";

type Member = {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  email: string | null;
  gender: string;
  dob: string | null;
  lang: "en" | "te" | "hi";
  goal: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  notes: string | null;
  source: string;
  trainerName: string | null;
  whatsappOptIn: boolean;
  status: LiveStatus;
  rawStatus: string;
  planName: string | null;
  startAt: string | null;
  expiresAt: string | null;
  balanceDue: number;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
};
type Props = {
  initialAction?: string;
  gym: { name: string; gstRate: number; gstInclusive: boolean };
  perms: { edit: boolean; bill: boolean; void: boolean; archive: boolean; viewBilling: boolean; viewMessages: boolean };
  member: Member;
  current: { planName: string; startAt: string; endAt: string; frozenDays: number; freezeUntil: string | null; status: string; progress: number } | null;
  daysLeft: number | null;
  ptPacks: { id: string; planName: string; used: number; total: number; endAt: string }[];
  memberships: {
    id: string;
    planName: string;
    type: string;
    startAt: string;
    endAt: string;
    status: string;
    price: number;
    discount: number;
    soldBy: string | null;
  }[];
  invoices: { id: string; number: string; issuedAt: string; total: number; paid: number; balance: number; status: "paid" | "partial" | "unpaid" | "void" }[];
  payments: { id: string; amount: number; method: string; reference: string | null; paidAt: string; invoiceNumber: string | null; by: string | null }[];
  messages: { id: string; playbook: string; body: string; status: string; channel: string; at: string }[];
  attendance: { cells: { key: string; value: number; label: string }[]; columns: number; last30: number; perWeek: number; streak: number; total120: number };
  plans: PlanOption[];
};

const INV_TONE: Record<string, Tone> = { paid: "lime", partial: "amber", unpaid: "red", void: "gray" };
const MSG_TONE: Record<string, Tone> = {
  sent: "lime",
  delivered: "lime",
  read: "green",
  manual: "blue",
  queued: "amber",
  sending: "amber",
  failed: "red",
  skipped: "gray",
};
const SOURCE_LABEL: Record<string, string> = {
  walkin: "Walk-in",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  referral: "Referral",
  website: "Website",
  other: "Other",
};
const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", other: "Other" };

export function MemberProfile(p: Props) {
  const { member: m } = p;
  const router = useRouter();
  const confirm = useConfirm();
  const [tab, setTab] = React.useState<"activity" | "billing" | "messages" | "history">("activity");
  const [dialog, setDialog] = React.useState<null | "sell" | "collect" | "freeze" | "edit" | "card">(
    p.initialAction === "renew" ? "sell" : p.initialAction === "collect" ? "collect" : p.initialAction === "card" ? "card" : null,
  );
  const [pending, start] = React.useTransition();

  const done = (msg?: string) => {
    if (msg) notify.success(msg);
    setDialog(null);
    router.refresh();
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) done(r.message);
      else notify.error(r.error ?? "Failed");
    });

  const daysLeft = p.daysLeft;
  const first = m.name.split(" ")[0];
  const meta = STATUS_META[m.status];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Members", href: "/members" }, { label: m.name }]}
        title={
          <span className="flex items-center gap-4">
            <PersonAvatar name={m.name} size={52} />
            <span className="min-w-0">
              <span className="block truncate">{m.name}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-normal text-muted-foreground">
                <StatusDot tone={meta.tone} pulse={m.status === "expiring"}>
                  {meta.label}
                </StatusDot>
                <span>{m.code}</span>
                <a href={`tel:${m.phone}`} className="anim-host inline-flex items-center gap-1 hover:text-foreground">
                  <AnimatedIcon icon={Phone} className="size-3.5" /> {fmtPhone(m.phone)}
                </a>
                <span>Joined {fmtDate(m.createdAt)}</span>
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={waLink(m.phone, `Hi ${first}, `) ?? "#"} target="_blank" rel="noreferrer">
                <AnimatedIcon icon={MessageCircle} /> WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await checkInAction(m.id);
                  if (!r.ok) return void notify.error(r.error);
                  if (r.data?.blocked) notify.warning(`No valid plan (${r.data.status}). Renew first, or use the front desk to let them in once.`);
                  else if (r.data?.duplicate) notify.info("Already checked in within the last hour");
                  else notify.success(`Checked in · visit #${r.data?.visitCount}`);
                  router.refresh();
                })
              }
            >
              <AnimatedIcon icon={ScanLine} /> Check in
            </Button>
            {p.perms.bill && (
              <Button onClick={() => setDialog("sell")}>
                <AnimatedIcon icon={RefreshCw} /> {m.status === "none" ? "Start membership" : "Renew"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setDialog("card")}>
                  <QrCode className="size-4" /> Member card & QR
                </DropdownMenuItem>
                {p.perms.edit && (
                  <DropdownMenuItem onSelect={() => setDialog("edit")}>
                    <Pencil className="size-4" /> Edit details
                  </DropdownMenuItem>
                )}
                {p.perms.bill && m.balanceDue > 0 && (
                  <DropdownMenuItem onSelect={() => setDialog("collect")}>
                    <Wallet className="size-4" /> Collect {inr(m.balanceDue)}
                  </DropdownMenuItem>
                )}
                {p.perms.edit && m.rawStatus === "frozen" && (
                  <DropdownMenuItem onSelect={() => run(() => unfreezeMemberAction(m.id))}>
                    <Play className="size-4" /> Resume membership
                  </DropdownMenuItem>
                )}
                {p.perms.edit && (m.status === "active" || m.status === "expiring") && (
                  <DropdownMenuItem onSelect={() => setDialog("freeze")}>
                    <Snowflake className="size-4" /> Freeze membership
                  </DropdownMenuItem>
                )}
                {p.perms.archive && (
                  <>
                    <DropdownMenuSeparator />
                    {m.rawStatus === "cancelled" ? (
                      <DropdownMenuItem onSelect={() => run(() => setMemberArchivedAction(m.id, false))}>
                        <Undo2 className="size-4" /> Restore member
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={async () => {
                          if (
                            await confirm({
                              title: `Archive ${m.name}?`,
                              description: "They'll stop receiving reminders and won't count as active. History is kept and you can restore them anytime.",
                              confirmLabel: "Archive",
                              destructive: true,
                            })
                          )
                            run(() => setMemberArchivedAction(m.id, true));
                        }}
                      >
                        <Archive className="size-4" /> Archive member
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* left rail */}
        <div className="flex flex-col gap-4">
          <div className="surface overflow-hidden">
            <div className="relative p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] text-muted-foreground">Current plan</p>
                  <p className="mt-0.5 text-lg font-semibold tracking-tight">{m.planName ?? "No active plan"}</p>
                </div>
                <Tag tone={meta.tone}>{meta.label}</Tag>
              </div>
              {p.current ? (
                <>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-track">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.current.progress}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        "h-full rounded-full",
                        m.status === "expiring" ? "bg-warning" : m.status === "expired" ? "bg-destructive" : m.status === "frozen" ? "bg-info" : "bg-primary",
                      )}
                    />
                  </div>
                  <div className="tabular mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{fmtDate(p.current.startAt)}</span>
                    <span>{fmtDate(m.expiresAt)}</span>
                  </div>
                  <p className="mt-3 text-sm">
                    {daysLeft == null ? (
                      ""
                    ) : daysLeft < 0 ? (
                      <span className="text-danger-ink">Expired {-daysLeft} days ago</span>
                    ) : daysLeft === 0 ? (
                      <span className="text-warning-ink">Expires today</span>
                    ) : (
                      <>
                        <b className="tabular">{daysLeft}</b> days left
                      </>
                    )}
                    {m.rawStatus === "frozen" && p.current.freezeUntil && (
                      <span className="ml-1 text-info-ink">· frozen until {fmtDate(p.current.freezeUntil)}</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Start a membership to track expiry, reminders and attendance.</p>
              )}
            </div>
            {p.ptPacks.length > 0 && (
              <div className="border-t p-5">
                <p className="mb-2 text-[13px] text-muted-foreground">Personal training</p>
                {p.ptPacks.map((x) => (
                  <div key={x.id} className="mb-2 last:mb-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{x.planName}</span>
                      <span className="tabular">
                        {x.used}/{x.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
                      <div className="h-full rounded-full bg-violet" style={{ width: `${(x.used / x.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {p.perms.viewBilling && (
              <div className={cn("flex items-center justify-between gap-3 border-t p-5", m.balanceDue > 0 && "bg-danger-soft/40")}>
                <div>
                  <p className="text-[13px] text-muted-foreground">Balance due</p>
                  <p className={cn("tabular text-xl font-semibold", m.balanceDue > 0 ? "text-danger-ink" : "text-foreground")}>{inr(m.balanceDue)}</p>
                </div>
                {p.perms.bill && m.balanceDue > 0 && (
                  <Button size="sm" onClick={() => setDialog("collect")}>
                    <AnimatedIcon icon={Wallet} /> Collect
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="surface p-5">
            <SectionTitle>Details</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Email" value={m.email} />
              <Detail label="Birthday" value={m.dob ? fmtDate(m.dob, "dd MMM") : null} />
              <Detail label="Goal" value={m.goal} icon={Target} />
              <Detail label="Trainer" value={m.trainerName} icon={Dumbbell} />
              <Detail label="Language" value={{ en: "English", te: "తెలుగు", hi: "हिंदी" }[m.lang]} />
              <Detail label="Source" value={SOURCE_LABEL[m.source] ?? m.source} />
              <Detail label="Emergency" value={m.emergencyName ? `${m.emergencyName} · ${fmtPhone(m.emergencyPhone)}` : null} className="col-span-2" />
              {m.notes && <Detail label="Notes" value={m.notes} className="col-span-2 whitespace-pre-wrap" />}
            </dl>
            {!m.whatsappOptIn && (
              <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">WhatsApp reminders are turned off for this member.</p>
            )}
          </div>
        </div>

        {/* right */}
        <div className="min-w-0">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini icon={ScanLine} label="Visits (30d)" value={String(p.attendance.last30)} />
            <Mini icon={TrendingUp} label="Avg / week" value={String(p.attendance.perWeek)} />
            <Mini icon={Flame} label="Streak" value={`${p.attendance.streak}d`} />
            <Mini icon={CalendarClock} label="Last visit" value={ago(m.lastVisitAt)} />
          </div>
          <div className="surface">
            <TabsBar
              className="px-4"
              layoutId="member-tabs"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "activity" as const, label: "Attendance" },
                ...(p.perms.viewBilling ? [{ value: "billing" as const, label: `Billing · ${p.invoices.length}` }] : []),
                ...(p.perms.viewMessages ? [{ value: "messages" as const, label: `Messages · ${p.messages.length}` }] : []),
                { value: "history" as const, label: "Plan history" },
              ]}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5"
              >
                {tab === "activity" && (
                  <>
                    <DotHeatmap cells={p.attendance.cells} columns={p.attendance.columns} rowLabels={["Mon", "", "Wed", "", "Fri", "", "Sun"]} tone="green" />
                    <p className="mt-3 text-xs text-muted-foreground">
                      {p.attendance.total120} training day{p.attendance.total120 === 1 ? "" : "s"} in the last 17 weeks · {m.visitCount} visit
                      {m.visitCount === 1 ? "" : "s"} all-time
                    </p>
                  </>
                )}
                {tab === "billing" && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[13px] font-medium text-muted-foreground">Invoices</p>
                      <ul className="flex flex-col gap-1">
                        {p.invoices.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</li>}
                        {p.invoices.map((i) => (
                          <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                            <ReceiptText className="size-4 shrink-0 text-muted-foreground" />
                            <Link href={`/billing/invoices/${i.id}`} className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{i.number}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(i.issuedAt)}</p>
                            </Link>
                            <span className="tabular text-sm font-semibold">{inr(i.total)}</span>
                            <Tag tone={INV_TONE[i.status]} className="capitalize">
                              {i.status}
                            </Tag>
                            {p.perms.void && i.status === "unpaid" && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                  if (
                                    await confirm({
                                      title: `Void ${i.number}?`,
                                      description: "The invoice is cancelled and its balance removed from dues.",
                                      confirmLabel: "Void",
                                      destructive: true,
                                    })
                                  )
                                    run(() => voidInvoiceAction(i.id));
                                }}
                              >
                                Void
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-[13px] font-medium text-muted-foreground">Payments</p>
                      <ul className="flex flex-col gap-1">
                        {p.payments.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No payments yet.</li>}
                        {p.payments.map((x) => (
                          <li key={x.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                            <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {METHOD[x.method]} {x.reference && <span className="font-normal text-muted-foreground">· {x.reference}</span>}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {fmtDateTime(x.paidAt)} · {x.by}
                              </p>
                            </div>
                            <span className="tabular text-sm font-semibold text-success-ink">+{inr(x.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {tab === "messages" && (
                  <ul className="flex flex-col gap-2">
                    {p.messages.length === 0 && (
                      <li className="py-8 text-center text-sm text-muted-foreground">No messages yet. Automations will appear here.</li>
                    )}
                    {p.messages.map((x) => (
                      <li key={x.id} className="rounded-xl border p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{PLAYBOOK_BY_KEY[x.playbook as PlaybookKey]?.title ?? x.playbook}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{fmtDateTime(x.at)}</span>
                            <Tag tone={MSG_TONE[x.status] ?? "gray"} className="capitalize">
                              {x.status}
                            </Tag>
                          </span>
                        </div>
                        <p className="rounded-lg bg-success-soft/40 px-3 py-2 text-sm whitespace-pre-wrap">{x.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {tab === "history" && (
                  <ol className="relative ml-2 border-l">
                    {p.memberships.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">No plans yet.</li>}
                    {p.memberships.map((x) => (
                      <li key={x.id} className="relative pb-5 pl-5 last:pb-0">
                        <span
                          className={cn(
                            "absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-4 ring-card",
                            x.status === "active"
                              ? "bg-primary"
                              : x.status === "cancelled"
                                ? "bg-destructive"
                                : x.status === "frozen"
                                  ? "bg-info"
                                  : "bg-subtle",
                          )}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{x.planName}</p>
                          <Tag tone={x.status === "active" ? "green" : x.status === "cancelled" ? "red" : "gray"} className="capitalize">
                            {x.status}
                          </Tag>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(x.startAt)} – {fmtDate(x.endAt)} · {inr(x.price - x.discount)}
                          {x.soldBy ? ` · by ${x.soldBy}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <SellDialog
        key={`sell-${dialog === "sell"}`}
        open={dialog === "sell"}
        onClose={() => setDialog(null)}
        onDone={done}
        member={m}
        plans={p.plans}
        gst={{ rate: p.gym.gstRate, inclusive: p.gym.gstInclusive }}
      />
      <CollectDialog key={`collect-${dialog === "collect"}`} open={dialog === "collect"} onClose={() => setDialog(null)} onDone={done} member={m} />
      <FreezeDialog key={`freeze-${dialog === "freeze"}`} open={dialog === "freeze"} onClose={() => setDialog(null)} onDone={done} member={m} />
      <MemberCard
        open={dialog === "card"}
        onClose={() => setDialog(null)}
        gymName={p.gym.name}
        member={{
          name: m.name,
          code: m.code,
          phone: m.phone,
          status: m.status,
          planName: m.planName,
          goal: m.goal,
          trainerName: m.trainerName,
          startAt: m.startAt,
          expiresAt: m.expiresAt,
          progress: p.current?.progress ?? null,
          daysLeft: p.daysLeft,
          visits30: p.attendance.last30,
          streak: p.attendance.streak,
        }}
      />
      <EditSheet key={`edit-${dialog === "edit"}`} open={dialog === "edit"} onClose={() => setDialog(null)} onDone={done} member={m} />
    </>
  );
}

function Detail({ label, value, icon: Icon, className }: { label: string; value: string | null | undefined; icon?: typeof Target; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="capitalize-first mt-0.5 flex items-center gap-1.5 truncate">
        {Icon && value && <Icon className="size-3.5 text-muted-foreground" />}
        {value || <span className="text-subtle">—</span>}
      </dd>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="surface anim-host p-3.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AnimatedIcon icon={icon} className="size-3.5" /> {label}
      </p>
      <p className="tabular mt-1 truncate text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

/* ───────── dialogs ───────── */

function SellDialog({
  open,
  onClose,
  onDone,
  member,
  plans,
  gst,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (m?: string) => void;
  member: Member;
  plans: PlanOption[];
  gst: { rate: number; inclusive: boolean };
}) {
  const [sale, setSale] = React.useState<SaleState>(() => initialSale(plans.find((x) => x.name === member.planName)?.id ?? plans[0]?.id));
  const [pending, start] = React.useTransition();
  const [key] = React.useState(() => crypto.randomUUID());
  const first = !member.planName;
  const t = saleTotals(sale, plans, gst, first);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>{first ? "Start a membership" : `Renew ${member.name.split(" ")[0]}`}</DialogTitle>
        <DialogDescription>
          {member.expiresAt && !first
            ? `The new plan starts after ${fmtDate(member.expiresAt)} unless you pick a date.`
            : "Choose a plan and record the payment."}
        </DialogDescription>
        <div className="mt-2">
          <PlanSaleFields plans={plans} sale={sale} onChange={setSale} gst={gst} withJoining={first} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={!t}
            onClick={() =>
              t &&
              start(async () => {
                const r = await sellMembershipAction({
                  memberId: member.id,
                  planId: sale.planId,
                  startAt: sale.startAt || undefined,
                  discount: Number(sale.discount) || 0,
                  includeJoiningFee: first,
                  idempotencyKey: key,
                  payment: t.paying > 0 ? { amount: t.paying, method: sale.method, reference: sale.reference || undefined } : null,
                });
                if (r.ok) onDone(`${t.plan.name} added · ${r.data?.number}${r.data?.balance ? ` · ₹${r.data.balance} due` : ""}`);
                else notify.error(r.error);
              })
            }
          >
            {t ? `Confirm · collect ${inr(t.paying)}` : "Choose a plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CollectDialog({ open, onClose, onDone, member }: { open: boolean; onClose: () => void; onDone: (m?: string) => void; member: Member }) {
  const [amount, setAmount] = React.useState(String(member.balanceDue || ""));
  const [method, setMethod] = React.useState<"upi" | "cash" | "card" | "bank">("upi");
  const [reference, setReference] = React.useState("");
  const [pending, start] = React.useTransition();
  const [key] = React.useState(() => crypto.randomUUID());
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Collect payment</DialogTitle>
        <DialogDescription>
          {member.name} owes <b className="text-foreground">{inr(member.balanceDue)}</b>. Payments settle the oldest invoices first.
        </DialogDescription>
        <div className="mt-2 grid gap-4">
          <Field label="Amount">
            <AffixInput leading="₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" autoFocus />
          </Field>
          <Field label="Method">
            <Segmented
              stretch
              size="md"
              value={method}
              onChange={setMethod}
              options={[
                { value: "upi", label: "UPI" },
                { value: "cash", label: "Cash" },
                { value: "card", label: "Card" },
                { value: "bank", label: "Bank" },
              ]}
            />
          </Field>
          <Field label="Reference" optional>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / receipt no." />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={!(Number(amount) > 0)}
            onClick={() =>
              start(async () => {
                const r = await recordPaymentAction({
                  memberId: member.id,
                  amount: Number(amount),
                  method,
                  reference: reference || undefined,
                  idempotencyKey: key,
                });
                if (r.ok) onDone(`${inr(Number(amount))} received${r.data?.balance ? ` · ${inr(r.data.balance)} still due` : " · fully paid 🎉"}`);
                else notify.error(r.error);
              })
            }
          >
            Record {Number(amount) > 0 ? inr(Number(amount)) : "payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FreezeDialog({ open, onClose, onDone, member }: { open: boolean; onClose: () => void; onDone: (m?: string) => void; member: Member }) {
  const [days, setDays] = React.useState("15");
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  const n = Number(days) || 0;
  const newExpiry = member.expiresAt ? new Date(new Date(member.expiresAt).getTime() + n * 86400e3) : null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <span className="grid size-10 place-items-center rounded-xl bg-info-soft text-info-ink">
          <Snowflake className="size-5" />
        </span>
        <DialogTitle>Freeze membership</DialogTitle>
        <DialogDescription>For travel, illness or exams. The expiry date moves forward by the frozen days.</DialogDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[7, 15, 30, 45, 60].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(String(d))}
              className={cn(
                "h-8 rounded-full border px-3 text-sm",
                Number(days) === d ? "border-info bg-info-soft text-info-ink" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d} days
            </button>
          ))}
        </div>
        <div className="grid gap-4">
          <Field label="Days">
            <AffixInput trailing="days" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" />
          </Field>
          <Field label="Reason" optional>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Travelling to Hyderabad" />
          </Field>
          {newExpiry && n > 0 && (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
              New expiry: <b>{fmtDate(newExpiry)}</b>
            </p>
          )}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={!(n >= 1 && n <= 180)}
            onClick={() =>
              start(async () => {
                const r = await freezeMemberAction(member.id, n, reason || undefined);
                if (r.ok) onDone(r.message);
                else notify.error(r.error);
              })
            }
          >
            <Snowflake /> Freeze {n > 0 ? `${n} days` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditSheet({ open, onClose, onDone, member }: { open: boolean; onClose: () => void; onDone: (m?: string) => void; member: Member }) {
  const [f, setF] = React.useState({
    name: member.name,
    phone: member.phone.replace(/^\+91/, ""),
    email: member.email ?? "",
    dob: member.dob?.slice(0, 10) ?? "",
    lang: member.lang,
    goal: member.goal ?? "",
    address: member.address ?? "",
    emergencyName: member.emergencyName ?? "",
    emergencyPhone: member.emergencyPhone?.replace(/^\+91/, "") ?? "",
    trainerName: member.trainerName ?? "",
    notes: member.notes ?? "",
    whatsappOptIn: member.whatsappOptIn,
  });
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
        <div className="border-b px-6 py-5">
          <SheetTitle>Edit {member.name}</SheetTitle>
          <SheetDescription>Contact details, preferences and notes.</SheetDescription>
        </div>
        <form
          id="edit-member"
          className="grid flex-1 scrollbar-thin content-start gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateMemberAction(member.id, { ...f, dob: f.dob || undefined });
              if (r.ok) onDone("Details saved");
              else {
                setErrors(r.fieldErrors ?? {});
                notify.error(r.error);
              }
            });
          }}
        >
          <Field label="Full name" error={errors.name} className="sm:col-span-2">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Mobile" error={errors.phone}>
            <AffixInput leading="+91" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Birthday">
            <Input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
          </Field>
          <Field label="Trainer">
            <Input value={f.trainerName} onChange={(e) => setF({ ...f, trainerName: e.target.value })} />
          </Field>
          <Field label="Message language" className="sm:col-span-2">
            <Segmented
              stretch
              size="md"
              value={f.lang}
              onChange={(v) => setF({ ...f, lang: v })}
              options={[
                { value: "en", label: "English" },
                { value: "te", label: "తెలుగు" },
                { value: "hi", label: "हिंदी" },
              ]}
            />
          </Field>
          <Field label="Goal">
            <Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="Emergency contact">
            <Input value={f.emergencyName} onChange={(e) => setF({ ...f, emergencyName: e.target.value })} />
          </Field>
          <Field label="Their phone">
            <AffixInput leading="+91" value={f.emergencyPhone} onChange={(e) => setF({ ...f, emergencyPhone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Injuries, preferences, batch timing…" />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 sm:col-span-2">
            <span>
              <span className="block text-sm font-medium">WhatsApp reminders</span>
              <span className="block text-xs text-muted-foreground">Member consented to receive updates.</span>
            </span>
            <Switch checked={f.whatsappOptIn} onCheckedChange={(v) => setF({ ...f, whatsappOptIn: v })} />
          </label>
        </form>
        <div className="flex justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-member" loading={pending}>
            Save changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
