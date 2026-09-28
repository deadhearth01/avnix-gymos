"use client";

import * as React from "react";
import { useActionState } from "react";
import { motion, AnimatePresence, useAnimate } from "motion/react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, TriangleAlert } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { cn } from "@/lib/utils";

export function LoginForm({ next, reason }: { next?: string; reason?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = React.useState(false);
  const [scope, animate] = useAnimate<HTMLFormElement>();

  React.useEffect(() => {
    if ((state.error || state.fieldErrors) && scope.current) {
      emitFeedback("error");
      animate(scope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.42 });
    }
  }, [state, animate, scope]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[380px]"
    >
      <h1 className="text-[28px] font-semibold tracking-[-0.025em]">Welcome back</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Sign in to run your gym — members, billing and automations in one place.</p>

      <AnimatePresence>
        {reason === "expired" && !state.error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-5 rounded-xl bg-info-soft px-3.5 py-2.5 text-sm text-info-ink"
          >
            Your session expired. Please sign in again.
          </motion.p>
        )}
      </AnimatePresence>

      <form ref={scope} action={action} className="mt-7 flex flex-col gap-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email" error={state.fieldErrors?.email} icon={Mail}>
          <input
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            autoFocus
            defaultValue={state.email}
            placeholder="you@yourgym.in"
            aria-invalid={!!state.fieldErrors?.email}
            className="peer h-11 w-full bg-transparent pr-3 pl-10 text-[15px] outline-none placeholder:text-subtle"
          />
        </Field>
        <Field label="Password" error={state.fieldErrors?.password} icon={Lock}>
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••"
            aria-invalid={!!state.fieldErrors?.password}
            className="peer h-11 w-full bg-transparent pr-11 pl-10 text-[15px] outline-none placeholder:text-subtle"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="anim-host absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <AnimatedIcon icon={show ? EyeOff : Eye} className="size-4" />
          </button>
        </Field>

        <AnimatePresence mode="popLayout">
          {state.error && (
            <motion.div
              key={state.error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </motion.div>
          )}
        </AnimatePresence>

        <Button type="submit" size="xl" loading={pending} className="mt-1 w-full">
          Sign in <AnimatedIcon icon={ArrowRight} className="size-4" />
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Forgot your password? Ask your gym owner or AvniX support to reset it — you&apos;ll get a new one instantly.
      </p>
    </motion.div>
  );
}

function Field({ label, error, icon: Icon, children }: { label: string; error?: string; icon: typeof Mail; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </Label>
      <div
        className={cn(
          "anim-host relative rounded-xl border bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10",
          error && "border-destructive/60 focus-within:border-destructive/60 focus-within:ring-destructive/10",
        )}
      >
        <AnimatedIcon icon={Icon} className="size-4" wrapperClassName="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
        {React.Children.map(children, (c, i) =>
          i === 0 && React.isValidElement(c) ? React.cloneElement(c as React.ReactElement<{ id?: string }>, { id }) : c,
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
