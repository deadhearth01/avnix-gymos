"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  Cake,
  CheckCheck,
  CircleAlert,
  HeartPulse,
  Inbox,
  WhatsApp,
  Play,
  Receipt,
  RefreshCw,
  Send,
  Settings2,
  SkipForward,
  Sparkles,
  Target,
  Wallet,
  Zap,
  type IconComponent,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { TabsBar } from "@/components/kit/tabs-bar";
import { Segmented } from "@/components/kit/segmented";
import { Tag, StatusDot, type Tone } from "@/components/kit/badges";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { EmptyState } from "@/components/kit/empty-state";
import { LiveDot } from "@/components/realtime/realtime-provider";
import { Stagger, StaggerItem } from "@/components/kit/motion";
import { render } from "@/lib/domain/playbooks";
import { ago, fmtDateTime, fmtPhone } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  markMessageManualAction,
  runJourneysNowAction,
  saveAutomationAction,
  sendMessageAction,
  skipMessageAction,
  toggleAutomationAction,
} from "../_actions/automations";

type Playbook = {
  key: string;
  title: string;
  description: string;
  category: string;
  trigger: "event" | "schedule";
  offsetsLabel: string | null;
  variables: string[];
  defaultEn: string;
  defaultTe: string;
  enabled: boolean;
  channel: "whatsapp" | "sms" | "email";
  templateEn: string;
  templateTe: string;
  offsets: number[];
  contentSid: string;
  sent30: number;
};
type Msg = {
  id: string;
  memberId: string | null;
  leadId: string | null;
  name: string;
  phone: string | null;
  playbook: string;
  channel: string;
  body: string;
  status: string;
  error: string | null;
  at: string;
  by: string | null;
};

const ICONS: Record<string, IconComponent> = {
  welcome: Sparkles,
  payment_receipt: Receipt,
  renewal: RefreshCw,
  expiry_day: CalendarClock,
  dues: Wallet,
  inactivity: HeartPulse,
  birthday: Cake,
  winback: Zap,
  trial_reminder: Target,
};
const STATUS_TONE: Record<string, Tone> = {
  queued: "amber",
  sending: "amber",
  sent: "lime",
  delivered: "lime",
  read: "green",
  manual: "blue",
  failed: "red",
  skipped: "gray",
};
const SAMPLE: Record<string, string> = {
  name: "Ravi",
  gym: "",
  plan: "Quarterly",
  expiry: "12 Oct 2026",
  days: "3",
  amount: "₹1,500",
  invoice: "INV/26-27/0142",
  trial: "Sat, 04 Oct, 6:30 am",
  address: "MVP Colony",
};

export function AutomationsView({
  playbooks,
  messages,
  counts,
  delivery,
  gymName,
  canManage,
  canSend,
}: {
  playbooks: Playbook[];
  messages: Msg[];
  counts: Record<string, number>;
  delivery: { enabled: boolean; auto: boolean; whatsapp: boolean; sms: boolean; lastRun: string | null };
  gymName: string;
  canManage: boolean;
  canSend: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"playbooks" | "outbox" | "log">(counts.queued ? "outbox" : "playbooks");
  const [editing, setEditing] = React.useState<Playbook | null>(null);
  const [sendMode, setSendMode] = React.useState(false);
  const [running, startRun] = React.useTransition();
  const queued = messages.filter((m) => m.status === "queued" || m.status === "failed");
  const log = messages.filter((m) => !["queued"].includes(m.status));
  const titleOf = (k: string) => playbooks.find((p) => p.key === k)?.title ?? k;
  const categories = [...new Set(playbooks.map((p) => p.category))];

  return (
    <>
      {/* delivery status */}
      <div
        className={cn(
          "mb-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center",
          delivery.enabled && delivery.auto ? "border-primary/25 bg-success-soft/40" : "bg-card",
        )}
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            delivery.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <WhatsApp className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {delivery.enabled
              ? delivery.auto
                ? "Automatic WhatsApp sending is on"
                : "WhatsApp connected · review before sending"
              : "One-tap sending from your team's WhatsApp"}
          </p>
          <p className="text-sm text-muted-foreground">
            {delivery.enabled
              ? delivery.auto
                ? "Messages go out between 9 AM and 8:30 PM, in each member's language."
                : "Messages wait in the outbox until someone taps Send."
              : "Messages queue in the outbox and your team sends each with one tap. Ask AvniX to connect your WhatsApp number for fully automatic sending."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot />
          {canManage && (
            <Button
              variant="outline"
              loading={running}
              onClick={() =>
                startRun(async () => {
                  const r = await runJourneysNowAction();
                  if (!r.ok) return void notify.error(r.error);
                  const d = r.data!;
                  notify.success(
                    d.created
                      ? `${d.created} new message${d.created === 1 ? "" : "s"} queued${d.sent ? ` · ${d.sent} sent` : ""}`
                      : "Everything's up to date — nothing new to send",
                  );
                  router.refresh();
                })
              }
            >
              <AnimatedIcon icon={Play} /> Run now
            </Button>
          )}
        </div>
      </div>

      <Stagger className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Waiting to send", value: counts.queued ?? 0, icon: Inbox, tone: "text-warning-ink" },
          { label: "Sent automatically", value: counts.sent ?? 0, icon: CheckCheck, tone: "text-success-ink" },
          { label: "Sent by your team", value: counts.manual ?? 0, icon: Send, tone: "text-info-ink" },
          { label: "Failed", value: counts.failed ?? 0, icon: CircleAlert, tone: "text-danger-ink" },
        ].map((k) => (
          <StaggerItem key={k.label} className="surface anim-host p-4">
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <AnimatedIcon icon={k.icon} className={cn("size-4", k.tone)} /> {k.label}
            </p>
            <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{k.value.toLocaleString("en-IN")}</p>
          </StaggerItem>
        ))}
      </Stagger>

      <TabsBar
        className="mb-5"
        layoutId="auto-tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "playbooks", label: "Playbooks", icon: Settings2 },
          {
            value: "outbox",
            label: "Outbox",
            icon: Inbox,
            badge: queued.length ? (
              <Tag tone="amber" className="h-5 px-1.5 text-[11px]">
                {queued.length}
              </Tag>
            ) : undefined,
          },
          { value: "log", label: "Sent log", icon: CheckCheck },
        ]}
      />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {tab === "playbooks" && (
            <div className="flex flex-col gap-6">
              {categories.map((cat) => (
                <section key={cat}>
                  <h2 className="mb-2.5 text-[13px] font-medium tracking-wide text-muted-foreground uppercase">{cat}</h2>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {playbooks
                      .filter((p) => p.category === cat)
                      .map((p) => (
                        <PlaybookCard key={p.key} p={p} canManage={canManage} onEdit={() => setEditing(p)} />
                      ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "outbox" && (
            <div className="surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                  <p className="text-[15px] font-semibold">
                    {queued.length} message{queued.length === 1 ? "" : "s"} ready
                  </p>
                  <p className="text-sm text-muted-foreground">Each opens WhatsApp with the text filled in — just tap send.</p>
                </div>
                {canSend && queued.length > 0 && (
                  <Button onClick={() => setSendMode(true)}>
                    <AnimatedIcon icon={Send} /> Start sending
                  </Button>
                )}
              </div>
              {queued.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Outbox is clear"
                  description="New reminders appear here as members approach renewal, owe dues or stop visiting."
                />
              ) : (
                <ul className="divide-y">
                  {queued.map((m) => (
                    <OutboxRow key={m.id} m={m} title={titleOf(m.playbook)} canSend={canSend} delivery={delivery} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "log" && (
            <div className="surface overflow-hidden">
              {log.length === 0 ? (
                <EmptyState icon={CheckCheck} title="Nothing sent yet" />
              ) : (
                <ul className="divide-y">
                  {log.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 p-4">
                      <PersonAvatar name={m.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{m.name}</p>
                          <span className="text-xs text-muted-foreground">{titleOf(m.playbook)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.body}</p>
                        {m.error && <p className="mt-1 text-xs text-danger-ink">{m.error}</p>}
                      </div>
                      <div className="text-right">
                        <Tag tone={STATUS_TONE[m.status] ?? "gray"} className="capitalize">
                          {m.status === "manual" ? "sent by team" : m.status}
                        </Tag>
                        <p className="mt-1 text-xs text-muted-foreground">{ago(m.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <EditSheet key={editing?.key ?? "none"} p={editing} gymName={gymName} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />
      <SendMode
        key={sendMode ? "on" : "off"}
        open={sendMode}
        queue={queued}
        titleOf={titleOf}
        onClose={() => {
          setSendMode(false);
          router.refresh();
        }}
      />
    </>
  );
}

function PlaybookCard({ p, canManage, onEdit }: { p: Playbook; canManage: boolean; onEdit: () => void }) {
  const [on, setOn] = React.useState(p.enabled);
  const [pending, start] = React.useTransition();
  const Icon = ICONS[p.key] ?? Sparkles;
  return (
    <motion.div layout className={cn("surface anim-host flex flex-col p-4 transition-shadow hover:shadow-[var(--shadow-float)]", !on && "opacity-80")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl transition-colors",
            on ? "bg-success-soft text-success-ink" : "bg-muted text-muted-foreground",
          )}
        >
          <AnimatedIcon icon={Icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{p.title}</p>
          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{p.description}</p>
        </div>
        <Switch
          checked={on}
          disabled={!canManage || pending}
          aria-label={`${p.title} ${on ? "on" : "off"}`}
          onCheckedChange={(v) => {
            setOn(v);
            start(async () => {
              const r = await toggleAutomationAction(p.key, v);
              if (!r.ok) {
                setOn(!v);
                notify.error(r.error);
              }
            });
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <Tag tone={p.trigger === "event" ? "violet" : "blue"}>{p.trigger === "event" ? "Instant" : "Scheduled"}</Tag>
        {p.offsets.length > 0 && p.offsetsLabel && (
          <Tag tone="gray">
            {p.offsets.join(", ")} {p.offsetsLabel}
          </Tag>
        )}
        <Tag tone="gray">EN + తెలుగు</Tag>
      </div>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="text-xs text-muted-foreground">{p.sent30 ? `${p.sent30} sent recently` : "No sends yet"}</span>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {canManage ? "Customise" : "Preview"}
        </Button>
      </div>
    </motion.div>
  );
}

function WaBubble({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#e7ddd3] bg-[radial-gradient(rgb(0_0_0/0.04)_1px,transparent_1px)] bg-[size:14px_14px] p-4 dark:bg-[#0b141a]">
      <motion.div
        key={text}
        initial={{ opacity: 0.6, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative ml-auto max-w-[88%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[14px] leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]"
      >
        <p className="whitespace-pre-wrap">{text || <span className="opacity-50">Empty message</span>}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0]">
          9:30 am <CheckCheck className="size-3 text-[#53bdeb]" />
        </p>
      </motion.div>
    </div>
  );
}

function EditSheet({ p, gymName, onClose, onSaved }: { p: Playbook | null; gymName: string; onClose: () => void; onSaved: () => void }) {
  const [lang, setLang] = React.useState<"en" | "te">("en");
  const [en, setEn] = React.useState(p?.templateEn || p?.defaultEn || "");
  const [te, setTe] = React.useState(p?.templateTe || p?.defaultTe || "");
  const [offsets, setOffsets] = React.useState((p?.offsets ?? []).join(", "));
  const [channel, setChannel] = React.useState<Playbook["channel"]>(p?.channel ?? "whatsapp");
  const [contentSid, setContentSid] = React.useState(p?.contentSid ?? "");
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  if (!p) return <Sheet open={false} />;
  const value = lang === "en" ? en : te;
  const setValue = lang === "en" ? setEn : setTe;
  const preview = render(value, { ...SAMPLE, gym: gymName });
  const insert = (v: string) => {
    const el = ref.current;
    const token = `{{${v}}}`;
    if (!el) return setValue(value + token);
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    setValue(value.slice(0, s) + token + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
        <div className="border-b px-6 py-5">
          <SheetTitle>{p.title}</SheetTitle>
          <SheetDescription>{p.description}</SheetDescription>
        </div>
        <div className="flex-1 scrollbar-thin overflow-y-auto px-6 py-5">
          <Segmented
            stretch
            size="md"
            value={lang}
            onChange={setLang}
            options={[
              { value: "en", label: "English" },
              { value: "te", label: "తెలుగు" },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {p.variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insert(v)}
                className="h-7 rounded-lg border bg-card px-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
          <Textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} className="mt-2 min-h-32 text-[15px]" maxLength={1000} />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => setValue(lang === "en" ? p.defaultEn : p.defaultTe)}>
              Reset to default
            </button>
            <span className="tabular">{value.length}/1000</span>
          </div>
          <p className="mt-5 mb-2 text-[13px] font-medium">Preview</p>
          <WaBubble text={preview} />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {p.offsetsLabel && (
              <Field label="When" hint={p.offsetsLabel} className="sm:col-span-2">
                <Input value={offsets} onChange={(e) => setOffsets(e.target.value.replace(/[^\d, ]/g, ""))} placeholder="7, 3, 1" />
              </Field>
            )}
            <Field label="Channel">
              <Segmented
                stretch
                size="md"
                value={channel}
                onChange={setChannel}
                options={[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "sms", label: "SMS" },
                ]}
              />
            </Field>
            <Field label="WhatsApp template (Content SID)" optional hint="Needed to message members who haven't replied in 24h">
              <Input value={contentSid} onChange={(e) => setContentSid(e.target.value.trim())} placeholder="HX…" className="font-mono" />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAutomationAction(p.key, {
                  templateEn: en === p.defaultEn ? "" : en,
                  templateTe: te === p.defaultTe ? "" : te,
                  channel,
                  offsets: offsets
                    .split(/[ ,]+/)
                    .filter(Boolean)
                    .map(Number)
                    .filter((n) => n >= 0 && n <= 365)
                    .slice(0, 6),
                  contentSid: contentSid || undefined,
                });
                if (!r.ok) return void notify.error(r.error);
                notify.success(`${p.title} saved`);
                onSaved();
                onClose();
              })
            }
          >
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OutboxRow({ m, title, canSend, delivery }: { m: Msg; title: string; canSend: boolean; delivery: { enabled: boolean; whatsapp: boolean } }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const href = waLink(m.phone, m.body);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <PersonAvatar name={m.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={m.memberId ? `/members/${m.memberId}` : "/leads"} className="text-sm font-semibold hover:underline">
              {m.name}
            </Link>
            <span className="text-xs text-muted-foreground">{fmtPhone(m.phone)}</span>
            <Tag tone="gray" className="h-5 text-[11px]">
              {title}
            </Tag>
            {m.status === "failed" && (
              <Tag tone="red" className="h-5 text-[11px]">
                Failed
              </Tag>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
          {m.error && <p className="mt-1 text-xs text-danger-ink">{m.error}</p>}
        </div>
      </div>
      {canSend && (
        <div className="flex shrink-0 gap-1.5 sm:flex-col">
          {href && (
            <Button
              size="sm"
              asChild
              onClick={() =>
                start(async () => {
                  await markMessageManualAction(m.id);
                  router.refresh();
                })
              }
            >
              <a href={href} target="_blank" rel="noreferrer" data-feedback="success">
                <WhatsApp /> WhatsApp
              </a>
            </Button>
          )}
          {delivery.enabled && delivery.whatsapp && (
            <Button
              size="sm"
              variant="outline"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await sendMessageAction(m.id);
                  if (r.ok) notify.success(`Sent to ${m.name}`);
                  else notify.error(r.error);
                  router.refresh();
                })
              }
            >
              <Send /> Auto-send
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              start(async () => {
                await skipMessageAction(m.id);
                router.refresh();
              })
            }
          >
            Skip
          </Button>
        </div>
      )}
    </li>
  );
}

/** Focused one-by-one sending flow for teams without automatic WhatsApp. */
function SendMode({ open, queue, titleOf, onClose }: { open: boolean; queue: Msg[]; titleOf: (k: string) => string; onClose: () => void }) {
  const [i, setI] = React.useState(0);
  const [sent, setSent] = React.useState(0);
  const m = queue[i];
  const done = i >= queue.length;
  const next = () => setI((x) => x + 1);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>{done ? "All done 🎉" : `Message ${i + 1} of ${queue.length}`}</DialogTitle>
        <DialogDescription>
          {done ? `You sent ${sent} message${sent === 1 ? "" : "s"}.` : "Tap Open WhatsApp, press send in WhatsApp, then come back for the next one."}
        </DialogDescription>
        <div className="h-1.5 overflow-hidden rounded-full bg-track">
          <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(Math.min(i, queue.length) / Math.max(1, queue.length)) * 100}%` }} />
        </div>
        <AnimatePresence mode="wait">
          {!done && m && (
            <motion.div key={m.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
              <div className="mb-3 flex items-center gap-3">
                <PersonAvatar name={m.name} size={40} />
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtPhone(m.phone)} · {titleOf(m.playbook)}
                  </p>
                </div>
                <StatusDot tone="amber" className="ml-auto">
                  queued {ago(m.at)}
                </StatusDot>
              </div>
              <WaBubble text={m.body} />
              <div className="mt-4 flex gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await skipMessageAction(m.id);
                    next();
                  }}
                >
                  <SkipForward /> Skip
                </Button>
                <Button asChild className="flex-1">
                  <a
                    href={waLink(m.phone, m.body) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    data-feedback="success"
                    onClick={async () => {
                      await markMessageManualAction(m.id);
                      setSent((s) => s + 1);
                      setTimeout(next, 400);
                    }}
                  >
                    <WhatsApp /> Open WhatsApp
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">{fmtDateTime(m.at)}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {done && (
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
