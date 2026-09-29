"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleCheck, CircleX, Info, Loader2, TriangleAlert, X, type IconComponent } from "@/components/icons";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "warning" | "info" | "loading";
export type ToastAction = { label: string; onClick: () => void; primary?: boolean };
export type AppToastProps = {
  kind: ToastKind;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Show this person's initials instead of the status icon (check-ins). */
  person?: string;
  actions?: ToastAction[];
  /** ms; drives the "time left" bar. 0 = stays until closed. */
  duration: number;
};

const KIND: Record<ToastKind, { icon: IconComponent; chip: string; bar: string }> = {
  success: { icon: CircleCheck, chip: "bg-success-soft text-success-ink", bar: "bg-success" },
  error: { icon: CircleX, chip: "bg-danger-soft text-danger-ink", bar: "bg-destructive" },
  warning: { icon: TriangleAlert, chip: "bg-warning-soft text-warning-ink", bar: "bg-warning" },
  info: { icon: Info, chip: "bg-primary/10 text-primary", bar: "bg-primary" },
  loading: { icon: Loader2, chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" },
};

/** The one toast used across GymOS (rendered through sonner's custom toasts). */
export function AppToast({ id, kind, title, description, person, actions, duration }: AppToastProps & { id: string | number }) {
  const k = KIND[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="group/toast relative flex w-[min(380px,calc(100vw-32px))] gap-3 overflow-hidden rounded-2xl border bg-popover p-3.5 pr-10 text-popover-foreground shadow-[var(--shadow-pop,0_18px_40px_-12px_rgb(0_0_0/0.28))]"
    >
      {person ? (
        <span className="relative shrink-0">
          <PersonAvatar name={person} size={40} />
          <span className={cn("absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-popover", k.chip)}>
            <k.icon className="size-3.5" />
          </span>
        </span>
      ) : (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", k.chip)}>
          <k.icon className={cn("size-5", kind === "loading" && "animate-spin")} />
        </span>
      )}
      <div className="min-w-0 flex-1 self-center">
        <p className="text-sm leading-snug font-semibold">{title}</p>
        {description && <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</div>}
        {actions && actions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  a.onClick();
                  toast.dismiss(id);
                }}
                className={cn(
                  "h-8 rounded-lg px-3 text-[13px] font-medium transition-colors",
                  a.primary ? "bg-primary text-primary-foreground hover:brightness-110" : "border bg-card hover:bg-muted",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={() => toast.dismiss(id)}
        className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-lg text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100"
      >
        <X className="size-4" />
      </button>
      {duration > 0 && kind !== "loading" && (
        <span
          aria-hidden
          className={cn("absolute bottom-0 left-0 h-[3px] w-full origin-left opacity-60 group-hover/toast:[animation-play-state:paused]", k.bar)}
          style={{ animation: `app-toast-timer ${duration}ms linear forwards` }}
        />
      )}
    </div>
  );
}

export function showToast(props: Omit<AppToastProps, "duration"> & { duration?: number; id?: string | number }) {
  const duration = props.duration ?? (props.kind === "error" ? 6000 : props.actions?.length ? 7000 : 3500);
  return toast.custom((id) => <AppToast id={id} {...props} duration={duration} />, { id: props.id, duration: duration || Infinity });
}
