"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { submitSiteLead } from "@/app/s/[site]/actions";
import type { ActionResult, GymSite } from "@/lib/types";

const BookingContext = React.createContext<(() => void) | null>(null);

export function BookingProvider({ children, site, whatsapp }: { children: React.ReactNode; site: string; whatsapp: string | null }) {
  const [open, setOpen] = React.useState(false);
  return (
    <BookingContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Your first step starts here</DialogTitle>
            <DialogDescription>Tell us a little about yourself and we’ll help arrange your free trial.</DialogDescription>
          </DialogHeader>
          <TrialForm site={site} whatsapp={whatsapp} />
        </DialogContent>
      </Dialog>
    </BookingContext.Provider>
  );
}

export function TrialButton({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "dark";
}) {
  const open = React.useContext(BookingContext);
  return (
    <Button type="button" variant={variant} size="xl" className={`min-h-11 ${className}`} onClick={() => open?.()}>
      {children}
    </Button>
  );
}

export function TrialForm({ site, whatsapp }: { site: string; whatsapp: string | null }) {
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const [pending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const response = await submitSiteLead(formData);
        setResult(response);
        if (response.ok) notify.success("Trial request sent");
        else notify.error(response.error);
      } catch {
        setResult({ ok: false, error: "We could not send your request. Please try again." });
        notify.error("Could not send the request");
      }
    });
  }
  if (result?.ok)
    return (
      <div role="status" className="relative overflow-hidden rounded-2xl bg-success-soft px-6 py-10 text-center">
        {!reduced &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute top-1/3 left-1/2 size-2 rounded-full bg-success"
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{ opacity: 0, x: Math.cos(i) * 90, y: Math.sin(i) * 80 }}
              transition={{ duration: 0.9 }}
            />
          ))}
        <motion.div
          initial={reduced ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white"
        >
          <Check className="size-8" />
        </motion.div>
        <h3 className="mt-5 text-xl font-semibold">Request received!</h3>
        <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
        {whatsapp && (
          <Button asChild size="lg" className="mt-6 min-h-11">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              Chat on WhatsApp
            </a>
          </Button>
        )}
      </div>
    );
  const errors = !result?.ok ? result?.fieldErrors : undefined;
  return (
    <form onSubmit={submit} className="grid gap-4">
      <input type="hidden" name="site" value={site} />
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="site-company">Company</label>
        <input id="site-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required error={errors?.name}>
          <Input name="name" autoComplete="name" required maxLength={128} placeholder="Your full name" className="min-h-11" />
        </Field>
        <Field label="Mobile number" required error={errors?.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" className="min-h-11" />
        </Field>
      </div>
      <Field label="Your goal" required error={errors?.goal}>
        <select
          name="goal"
          required
          defaultValue=""
          className="min-h-11 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
        >
          <option value="" disabled>
            What would you like to achieve?
          </option>
          {["Weight loss", "Muscle gain", "General fitness", "Strength", "Sports", "Other"].map((goal) => (
            <option key={goal}>{goal}</option>
          ))}
        </select>
      </Field>
      <Field label="Preferred trial date and time" optional error={errors?.trialAt} hint="Times are in India Standard Time.">
        <Input name="trialAt" type="datetime-local" className="min-h-11" />
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 accent-primary" />
        <span>I agree to be contacted about my trial and membership options.</span>
      </label>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      )}
      <Button type="submit" size="xl" loading={pending} className="min-h-12 w-full">
        Request my free trial <ArrowRight className="size-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">No payment needed. We’ll be in touch soon.</p>
    </form>
  );
}

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function matchingHours(hours: NonNullable<GymSite["hours"]>, day: number) {
  return hours.find((row) => {
    const label = row.days.toLowerCase().replace(/[–—]/g, "-").trim();
    if (label === "daily" || label === "every day" || label === "all days") return true;
    const range = label.split("-").map((part) => SHORT_DAYS.findIndex((name) => part.trim().startsWith(name)));
    if (range.length === 2 && range.every((n) => n >= 0)) return range[0] <= range[1] ? day >= range[0] && day <= range[1] : day >= range[0] || day <= range[1];
    return label.split(/[,/&]/).some((part) => part.trim().startsWith(SHORT_DAYS[day]));
  });
}

export function HoursBadge({ hours }: { hours: NonNullable<GymSite["hours"]> }) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);
  if (hours.length === 0) return <span className="text-sm text-white/70">Contact us for opening hours</span>;
  if (now === null) return <span className="text-sm text-white/70">Hours shown in IST</span>;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = DAY_NAMES.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  const minutes = Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const today = matchingHours(hours, day);
  const time = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
  };
  const open = today ? time(today.open) : -1;
  const close = today ? time(today.close) : -1;
  const isOpen = open >= 0 && close >= 0 && (close < open ? minutes >= open || minutes < close : minutes >= open && minutes < close);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isOpen ? "bg-success-soft text-success-ink" : "bg-muted text-muted-foreground"}`}
    >
      <span className={`size-2 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground"}`} />
      {isOpen ? "Open now" : "Closed now"}
    </span>
  );
}

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = React.useState<number | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:auto-rows-[180px] md:grid-cols-4">
        {images.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            onClick={() => setSelected(index)}
            aria-label={`Open ${name} gallery image ${index + 1}`}
            className={`group relative min-h-44 overflow-hidden rounded-2xl bg-muted text-left focus-visible:outline-3 focus-visible:outline-primary ${index === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
          >
            <Image
              src={src}
              alt={`${name} facility ${index + 1}`}
              fill
              unoptimized
              sizes={index === 0 ? "(max-width: 768px) 50vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
            />
            <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
          </button>
        ))}
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-5xl border-0 bg-black p-2 sm:max-w-5xl" showCloseButton>
          <DialogHeader className="sr-only">
            <DialogTitle>{name} gallery</DialogTitle>
            <DialogDescription>
              Facility image {selected === null ? "" : selected + 1} of {images.length}
            </DialogDescription>
          </DialogHeader>
          {selected !== null && (
            <div className="relative aspect-[4/3] max-h-[78dvh] w-full">
              <Image src={images[selected]} alt={`${name} facility ${selected + 1}`} fill unoptimized sizes="95vw" className="object-contain" />
            </div>
          )}
          <div className="flex justify-between gap-4 px-3 pb-2 text-white">
            <button type="button" className="min-h-11 px-3" onClick={() => setSelected((v) => (v === null ? null : (v - 1 + images.length) % images.length))}>
              Previous
            </button>
            <span className="self-center text-sm">{selected === null ? "" : `${selected + 1} / ${images.length}`}</span>
            <button type="button" className="min-h-11 px-3" onClick={() => setSelected((v) => (v === null ? null : (v + 1) % images.length))}>
              Next
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CtaIcon() {
  return <AnimatedIcon icon={Sparkles} />;
}
export function ArrowIcon() {
  return <AnimatedIcon icon={ArrowRight} />;
}
export function WhatsAppIcon() {
  return <AnimatedIcon icon={MessageCircle} />;
}

export function SiteAnchor({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
        history.replaceState(null, "", href);
      }}
    >
      {children}
    </a>
  );
}
