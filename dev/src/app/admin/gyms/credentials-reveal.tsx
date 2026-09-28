"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { notify } from "@/lib/notify";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { useConfirm } from "@/components/kit/confirm";
import { emailCredentialsAction } from "../actions";

export type RevealData = {
  gymId: string;
  gymName: string;
  email: string;
  password: string | null;
  loginUrl: string;
  siteUrl?: string;
  emailed?: boolean;
  note?: string;
  /** "owner" (default) or a staff role label used in copy */
  audience?: string;
  /** show "Email to owner" (super-admin only) */
  allowEmail?: boolean;
};

export function CopyButton({ value, label = "Copy", onCopied }: { value: string; label?: string; onCopied?: () => void }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      data-feedback="success"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          onCopied?.();
          setTimeout(() => setDone(false), 1600);
        } catch {
          notify.error("Couldn't copy — select and copy manually.");
        }
      }}
      className="anim-host inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
      aria-label={`${label} to clipboard`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span
            key="d"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="inline-flex items-center gap-1 text-success-ink"
          >
            <Check className="size-3.5" /> Copied
          </motion.span>
        ) : (
          <motion.span
            key="c"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="inline-flex items-center gap-1"
          >
            <AnimatedIcon icon={Copy} className="size-3.5" /> {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function CredentialsReveal({ data, open, onOpenChange }: { data: RevealData | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!data) return null;
  return <RevealDialog key={`${data.gymId}:${data.password ?? ""}`} data={data} open={open} onOpenChange={onOpenChange} />;
}

function RevealDialog({ data, open, onOpenChange }: { data: RevealData; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [show, setShow] = React.useState(true);
  const [sending, start] = React.useTransition();
  const [emailed, setEmailed] = React.useState(!!data.emailed);
  const [copied, setCopied] = React.useState(false);
  const confirm = useConfirm();
  const markCopied = () => setCopied(true);
  const all = `GymOS login for ${data.gymName}\nSign in: ${data.loginUrl}\nEmail: ${data.email}\nPassword: ${data.password ?? "(existing account — unchanged)"}${data.siteUrl ? `\nWebsite: ${data.siteUrl}` : ""}`;

  return (
    <Dialog
      open={open}
      onOpenChange={async (v) => {
        if (!v && data.password && !emailed && !copied) {
          const ok = await confirm({
            title: "Close without saving the password?",
            description: "It won't be shown again. You can always reset it later from the gym page.",
            confirmLabel: "Close anyway",
            destructive: true,
          });
          if (!ok) return;
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_100%_at_0%_0%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_60%)] px-6 pt-6 pb-5">
          <motion.span
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgb(22_163_74/0.6)]"
          >
            <KeyRound className="size-5" />
          </motion.span>
          <DialogTitle className="mt-4 text-lg">Login details{data.audience && data.audience !== "owner" ? "" : ` for ${data.gymName}`}</DialogTitle>
          <DialogDescription className="mt-1">
            {data.note ?? `Share these with the ${data.audience ?? "owner"}. The password is shown only once — it isn't stored anywhere.`}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-2.5 px-6 py-5">
          <Row label="Sign-in page" value={data.loginUrl} />
          <Row label="Email" value={data.email} />
          {data.password ? (
            <div className="rounded-xl border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Password</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow((s) => !s)}
                    className="anim-host grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <AnimatedIcon icon={show ? EyeOff : Eye} className="size-4" />
                  </button>
                  <CopyButton value={data.password} onCopied={markCopied} />
                </div>
              </div>
              <p className="mt-1 font-mono text-[19px] font-semibold tracking-wider break-all select-all">
                {show ? data.password : "•".repeat(data.password.length)}
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-info-soft px-3.5 py-2.5 text-sm text-info-ink">
              This owner already had a GymOS account, so their existing password still works. They&apos;ll see the new gym after signing in.
            </p>
          )}
          {data.siteUrl && <Row label="Website" value={data.siteUrl} />}

          <div className="mt-1 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            {data.audience && data.audience !== "owner" ? "They" : "The owner"} will be asked to change this password after their first sign-in.
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <CopyButton value={all} label="Copy all" onCopied={markCopied} />
          {data.password && data.allowEmail && (
            <Button
              variant={emailed ? "soft" : "outline"}
              loading={sending}
              disabled={emailed}
              onClick={() =>
                start(async () => {
                  const r = await emailCredentialsAction(data.gymId, data.password!);
                  if (r.ok) {
                    setEmailed(true);
                    notify.success(`Emailed to ${data.email}`);
                  } else notify.error(r.error);
                })
              }
            >
              <AnimatedIcon icon={emailed ? Check : Mail} /> {emailed ? "Emailed" : "Email to owner"}
            </Button>
          )}
          <Button
            onClick={async () => {
              if (data.password && !emailed && !copied) {
                const ok = await confirm({
                  title: "Close without saving the password?",
                  description: "It won't be shown again. You can reset it later from the gym page.",
                  confirmLabel: "Close anyway",
                  destructive: true,
                });
                if (!ok) return;
              }
              emitFeedback("success");
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}
