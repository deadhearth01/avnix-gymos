"use client";

import type * as React from "react";
import { toast } from "sonner";
import { showToast, type ToastAction } from "@/components/feedback/app-toast";
import { emitFeedback } from "@/components/feedback/feedback-provider";

type Opts = {
  description?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  actions?: ToastAction[];
  duration?: number;
  id?: string | number;
};

const actionsOf = (o?: Opts) => o?.actions ?? (o?.action ? [{ ...o.action, primary: true }] : undefined);

/** Toasts (one design everywhere) that also fire the matching haptic / sound cue. */
export const notify = {
  success(message: React.ReactNode, opts?: Opts) {
    emitFeedback("success");
    return showToast({ kind: "success", title: message, description: opts?.description, actions: actionsOf(opts), duration: opts?.duration, id: opts?.id });
  },
  error(message: React.ReactNode, opts?: Opts) {
    emitFeedback("error");
    return showToast({ kind: "error", title: message, description: opts?.description, actions: actionsOf(opts), duration: opts?.duration, id: opts?.id });
  },
  warning(message: React.ReactNode, opts?: Opts) {
    emitFeedback("warning");
    return showToast({ kind: "warning", title: message, description: opts?.description, actions: actionsOf(opts), duration: opts?.duration, id: opts?.id });
  },
  info(message: React.ReactNode, opts?: Opts) {
    return showToast({ kind: "info", title: message, description: opts?.description, actions: actionsOf(opts), duration: opts?.duration, id: opts?.id });
  },
  /** A check-in result: the member's initials with a status badge. */
  person(kind: "success" | "warning" | "error", name: string, title: React.ReactNode, opts?: Opts) {
    emitFeedback(kind);
    return showToast({ kind, person: name, title, description: opts?.description, actions: actionsOf(opts), duration: opts?.duration, id: opts?.id });
  },
  promise: toast.promise,
  dismiss: toast.dismiss,
};
