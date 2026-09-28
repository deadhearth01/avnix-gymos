"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Clock, GripVertical, MessageCircle, MoreHorizontal, Phone, Plus, Search, Target, Trash2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, AffixInput } from "@/components/forms/field";
import { Tag, type Tone } from "@/components/kit/badges";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { EmptyState } from "@/components/kit/empty-state";
import { useConfirm } from "@/components/kit/confirm";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { ago, fmtPhone } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { convertLeadAction, createLeadAction, deleteLeadAction, updateLeadAction } from "../_actions/leads";

type Status = "new" | "contacted" | "trial_booked" | "trial_done" | "joined" | "lost";
type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  goal: string | null;
  status: Status;
  trialAt: string | null;
  followUpAt: string | null;
  notes: string | null;
  lostReason: string | null;
  memberId: string | null;
  createdAt: string;
  assignedName: string | null;
};

const COLUMNS: { status: Status; label: string; tone: Tone; hint: string }[] = [
  { status: "new", label: "New", tone: "blue", hint: "Reply within 10 minutes" },
  { status: "contacted", label: "Contacted", tone: "violet", hint: "Book them a trial" },
  { status: "trial_booked", label: "Trial booked", tone: "amber", hint: "Reminder goes out automatically" },
  { status: "trial_done", label: "Trial done", tone: "lime", hint: "Make the offer today" },
  { status: "joined", label: "Joined", tone: "green", hint: "Converted to members" },
  { status: "lost", label: "Lost", tone: "gray", hint: "Learn why" },
];
const SOURCE: Record<string, string> = {
  walkin: "Walk-in",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  referral: "Referral",
  website: "Website",
  other: "Other",
};
const LOST_REASONS = ["Price", "Too far", "Timing", "Joined another gym", "Not interested", "No response"];

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

export function LeadsBoard({
  leads: initial,
  gymName,
  canEdit,
  canConvert,
  openNew,
}: {
  leads: Lead[];
  gymName: string;
  canEdit: boolean;
  canConvert: boolean;
  openNew: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [leads, setLeads] = React.useState(initial);
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setLeads(initial);
  }
  const [q, setQ] = React.useState("");
  const [drag, setDrag] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<Status | null>(null);
  const [adding, setAdding] = React.useState(openNew);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [losing, setLosing] = React.useState<Lead | null>(null);

  const filtered = q.trim() ? leads.filter((l) => `${l.name} ${l.phone} ${l.goal ?? ""}`.toLowerCase().includes(q.toLowerCase())) : leads;

  const move = async (lead: Lead, status: Status) => {
    if (lead.status === status) return;
    if (status === "lost") return setLosing(lead);
    if (status === "joined") {
      if (!canConvert) return void notify.error("You can't convert leads.");
      const ok = await confirm({
        title: `Convert ${lead.name} to a member?`,
        description: "We'll create their member profile so you can sell a plan.",
        confirmLabel: "Convert",
      });
      if (!ok) return;
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
      const r = await convertLeadAction(lead.id);
      if (!r.ok) {
        setLeads((ls) => ls.map((l) => (l.id === lead.id ? lead : l)));
        return void notify.error(r.error);
      }
      notify.success(`${lead.name} is now a member 🎉`, {
        action: { label: "Sell plan", onClick: () => router.push(`/members/${r.data!.memberId}?action=renew`) },
      });
      return;
    }
    const prev = lead.status;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    emitFeedback("select");
    const r = await updateLeadAction(lead.id, { status });
    if (!r.ok) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
      notify.error(r.error);
    }
  };

  const totalOpen = leads.filter((l) => !["joined", "lost"].includes(l.status)).length;
  const conv = leads.length ? Math.round((leads.filter((l) => l.status === "joined").length / leads.length) * 100) : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <b className="tabular text-foreground">{totalOpen}</b> open
          </span>
          <span>
            <b className="tabular text-foreground">{conv}%</b> converted
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leads"
              className="h-9 w-48 rounded-[10px] bg-muted/80 pr-3 pl-9 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-primary/25 sm:w-60"
            />
          </label>
          {canEdit && (
            <Button onClick={() => setAdding(true)}>
              <AnimatedIcon icon={Plus} /> Add lead
            </Button>
          )}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={Target}
            title="No leads yet"
            description="Enquiries from your website's trial form land here automatically. You can also add walk-ins."
            action={
              canEdit ? (
                <Button onClick={() => setAdding(true)}>
                  <Plus /> Add lead
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory scrollbar-thin gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {COLUMNS.map((col) => {
            const items = filtered.filter((l) => l.status === col.status);
            return (
              <section
                key={col.status}
                aria-label={col.label}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setOver(col.status);
                }}
                onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const lead = leads.find((l) => l.id === drag);
                  setDrag(null);
                  if (lead) void move(lead, col.status);
                }}
                className={cn(
                  "flex w-[290px] shrink-0 snap-start flex-col rounded-2xl border bg-muted/40 p-2 transition-[background-color,box-shadow] duration-200",
                  over === col.status && "bg-success-soft/40 ring-2 ring-primary/30",
                )}
              >
                <header className="px-2 pt-1.5 pb-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Tag tone={col.tone} className="h-5 px-1.5">
                      {items.length}
                    </Tag>
                    {col.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-subtle">{col.hint}</span>
                </header>
                <div className="flex min-h-24 flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {items.map((l) => (
                      <motion.article
                        key={l.id}
                        layout
                        layoutId={`lead-${l.id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: drag === l.id ? 0.5 : 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        draggable={canEdit}
                        onDragStartCapture={() => setDrag(l.id)}
                        onDragEndCapture={() => {
                          setDrag(null);
                          setOver(null);
                        }}
                        className={cn(
                          "group rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-float)]",
                          canEdit && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <PersonAvatar name={l.name} size={30} />
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(l)}>
                            <p className="truncate text-sm font-semibold">{l.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{fmtPhone(l.phone)}</p>
                          </button>
                          {canEdit && <GripVertical className="size-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <Tag tone="gray" className="h-5 text-[11px]">
                            {SOURCE[l.source] ?? l.source}
                          </Tag>
                          {l.goal && (
                            <Tag tone="lime" className="h-5 text-[11px]">
                              {l.goal}
                            </Tag>
                          )}
                          {l.trialAt && l.status === "trial_booked" && (
                            <Tag tone="amber" className="h-5 text-[11px]">
                              <CalendarClock className="size-3" /> {fmtWhen(l.trialAt)}
                            </Tag>
                          )}
                          {l.followUpAt && !["joined", "lost"].includes(l.status) && (
                            <Tag tone="blue" className="h-5 text-[11px]">
                              <Clock className="size-3" /> {fmtWhen(l.followUpAt)}
                            </Tag>
                          )}
                          {l.lostReason && l.status === "lost" && (
                            <Tag tone="red" className="h-5 text-[11px]">
                              {l.lostReason}
                            </Tag>
                          )}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-[11px] text-subtle">{ago(l.createdAt)}</span>
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${l.phone}`}
                              aria-label={`Call ${l.name}`}
                              className="anim-host grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <AnimatedIcon icon={Phone} className="size-3.5" />
                            </a>
                            <a
                              href={
                                waLink(
                                  l.phone,
                                  `Hi ${l.name.split(" ")[0]}, thanks for your interest in ${gymName}! 💪 When would you like to come in for a free trial session?`,
                                ) ?? "#"
                              }
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`WhatsApp ${l.name}`}
                              onClick={() => l.status === "new" && canEdit && move(l, "contacted")}
                              className="anim-host grid size-7 place-items-center rounded-lg text-success-ink hover:bg-success-soft"
                            >
                              <AnimatedIcon icon={MessageCircle} className="size-3.5" />
                            </a>
                            {canEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="More"
                                    className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                                  >
                                    <MoreHorizontal className="size-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {COLUMNS.filter((c) => c.status !== l.status).map((c) => (
                                    <DropdownMenuItem key={c.status} onSelect={() => move(l, c.status)}>
                                      Move to {c.label}
                                    </DropdownMenuItem>
                                  ))}
                                  {l.memberId && (
                                    <DropdownMenuItem onSelect={() => router.push(`/members/${l.memberId}`)}>
                                      <UserCheck className="size-4" /> Open member
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={async () => {
                                      if (!(await confirm({ title: `Delete ${l.name}?`, confirmLabel: "Delete", destructive: true }))) return;
                                      setLeads((ls) => ls.filter((x) => x.id !== l.id));
                                      const r = await deleteLeadAction(l.id);
                                      if (!r.ok) {
                                        notify.error(r.error);
                                        router.refresh();
                                      }
                                    }}
                                  >
                                    <Trash2 className="size-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed py-6 text-center text-xs text-subtle">{canEdit ? "Drop a lead here" : "Empty"}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <LeadDialog
        key={adding ? "add-open" : "add"}
        open={adding}
        onClose={() => {
          setAdding(false);
          if (openNew) router.replace("/leads");
        }}
        onSaved={() => router.refresh()}
      />
      <LeadDialog
        key={editing?.id ?? "edit"}
        open={!!editing}
        lead={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
        readOnly={!canEdit}
      />
      <LostDialog
        key={losing?.id ?? "lost"}
        lead={losing}
        onClose={() => setLosing(null)}
        onConfirm={async (reason) => {
          const lead = losing!;
          setLosing(null);
          setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: "lost", lostReason: reason } : l)));
          const r = await updateLeadAction(lead.id, { status: "lost", lostReason: reason });
          if (!r.ok) {
            notify.error(r.error);
            router.refresh();
          }
        }}
      />
    </>
  );
}

function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LeadDialog({ open, lead, onClose, onSaved, readOnly }: { open: boolean; lead?: Lead; onClose: () => void; onSaved: () => void; readOnly?: boolean }) {
  const [f, setF] = React.useState({
    name: lead?.name ?? "",
    phone: lead?.phone.replace(/^\+91/, "") ?? "",
    source: lead?.source ?? "walkin",
    goal: lead?.goal ?? "",
    trialAt: toLocal(lead?.trialAt ?? null),
    followUpAt: toLocal(lead?.followUpAt ?? null),
    notes: lead?.notes ?? "",
  });
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>{lead ? lead.name : "Add a lead"}</DialogTitle>
        <DialogDescription>
          {lead
            ? `Added ${ago(lead.createdAt)}${lead.assignedName ? ` by ${lead.assignedName}` : ""}`
            : "Walk-in, call or DM — capture it before it's forgotten."}
        </DialogDescription>
        <form
          className="mt-2 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (readOnly) return;
            start(async () => {
              const payload = {
                ...f,
                trialAt: f.trialAt ? new Date(f.trialAt).toISOString() : undefined,
                followUpAt: f.followUpAt ? new Date(f.followUpAt).toISOString() : undefined,
                goal: f.goal || undefined,
                notes: f.notes || undefined,
                source: f.source as never,
              };
              const r = lead
                ? await updateLeadAction(lead.id, { ...payload, trialAt: payload.trialAt ?? "", followUpAt: payload.followUpAt ?? "" })
                : await createLeadAction(payload);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return void notify.error(r.error);
              }
              notify.success(lead ? "Lead updated" : "Lead added");
              onSaved();
              onClose();
            });
          }}
        >
          <Field label="Name" required error={errors.name}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={readOnly} autoFocus={!lead} />
          </Field>
          <Field label="Mobile" required error={errors.phone}>
            <AffixInput leading="+91" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" disabled={readOnly} />
          </Field>
          <Field label="Source">
            <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })} disabled={readOnly}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Goal">
            <Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Weight loss" disabled={readOnly} />
          </Field>
          <Field label="Trial on" hint="Sends an automatic reminder">
            <Input type="datetime-local" value={f.trialAt} onChange={(e) => setF({ ...f, trialAt: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Follow up on">
            <Input type="datetime-local" value={f.followUpAt} onChange={(e) => setF({ ...f, followUpAt: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              placeholder="Prefers evening batch, asked about PT…"
              disabled={readOnly}
            />
          </Field>
          {!readOnly && (
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {lead ? "Save" : "Add lead"}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LostDialog({ lead, onClose, onConfirm }: { lead: Lead | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open={!!lead} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Why didn&apos;t {lead?.name.split(" ")[0]} join?</DialogTitle>
        <DialogDescription>Tracking reasons shows you what to fix — pricing, timings or follow-up speed.</DialogDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "h-8 rounded-full border px-3 text-sm transition-colors",
                reason === r ? "border-destructive/50 bg-danger-soft text-danger-ink" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason" className="mt-1" />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X /> Cancel
          </Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            Mark as lost
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
