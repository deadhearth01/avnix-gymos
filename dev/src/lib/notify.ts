"use client";

import { toast, type ExternalToast } from "sonner";
import { emitFeedback } from "@/components/feedback/feedback-provider";

/** Toasts that also fire the matching haptic / sound cue. */
export const notify = {
  success(message: string, opts?: ExternalToast) {
    emitFeedback("success");
    return toast.success(message, opts);
  },
  error(message: string, opts?: ExternalToast) {
    emitFeedback("error");
    return toast.error(message, opts);
  },
  warning(message: string, opts?: ExternalToast) {
    emitFeedback("warning");
    return toast.warning(message, opts);
  },
  info(message: string, opts?: ExternalToast) {
    return toast(message, opts);
  },
  promise: toast.promise,
  dismiss: toast.dismiss,
};
