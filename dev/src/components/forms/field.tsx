"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + hint/error with animated error reveal. Wires aria ids. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  optional,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const id = React.useId();
  const msg = Array.isArray(error) ? error[0] : error;
  const describedBy = msg ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={id} className="text-[13px] font-medium text-foreground/90">
          {label}
          {required && <span className="text-destructive">*</span>}
          {optional && <span className="font-normal text-subtle">optional</span>}
        </Label>
      )}
      {React.cloneElement(children, { id, "aria-invalid": !!msg || undefined, "aria-describedby": describedBy })}
      <AnimatePresence initial={false} mode="wait">
        {msg ? (
          <motion.p
            key="e"
            id={`${id}-err`}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-destructive"
          >
            {msg}
          </motion.p>
        ) : hint ? (
          <motion.p key="h" id={`${id}-hint`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-muted-foreground">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-5 border-b py-7 first:pt-0 last:border-b-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10", className)}>
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Input with a leading adornment like ₹ or +91 */
export function AffixInput({
  leading,
  trailing,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "prefix"> & { leading?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-[10px] border border-input bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10 hover:border-foreground/20 has-[[aria-invalid=true]]:border-destructive/60 has-[input:disabled]:bg-muted/50 has-[input:disabled]:text-muted-foreground has-[input:disabled]:shadow-none",
        className,
      )}
    >
      {leading && <span className="pl-3 text-sm text-muted-foreground select-none">{leading}</span>}
      <input {...props} className="tabular h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-subtle sm:text-sm" />
      {trailing && <span className="pr-3 text-sm text-muted-foreground select-none">{trailing}</span>}
    </div>
  );
}
