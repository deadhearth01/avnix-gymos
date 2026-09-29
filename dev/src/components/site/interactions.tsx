"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Menu, X } from "@/components/icons";
import { BrandIcon } from "@/components/brand/social-icons";
import { isDefaultLogoUrl } from "@/lib/site/presets";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { submitSiteLead } from "@/app/s/[site]/actions";
import type { ActionResult, GymSite } from "@/lib/types";
import { ProfileCard } from "./profile-card";
import { buttonTone, formatHours, type Tone } from "./tone";

type Booking = { open: (() => void) | null; whatsapp: string | null; themeStyle: React.CSSProperties | undefined };
const BookingContext = React.createContext<Booking>({ open: null, whatsapp: null, themeStyle: undefined });

export function BookingProvider({
  children,
  site,
  whatsapp,
  trial,
  themeStyle,
}: {
  children: React.ReactNode;
  site: string;
  whatsapp: string | null;
  trial: boolean;
  themeStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo<Booking>(() => ({ open: trial ? () => setOpen(true) : null, whatsapp, themeStyle }), [trial, whatsapp, themeStyle]);
  return (
    <BookingContext.Provider value={value}>
      {children}
      {trial && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent style={themeStyle} className="gs max-h-[92dvh] overflow-y-auto rounded-[22px] border-0 bg-white p-6 sm:max-w-lg sm:p-8">
            <DialogHeader>
              <DialogTitle className="gs-display text-4xl">Book a free trial</DialogTitle>
              <DialogDescription className="text-[15px] text-gs-steel">Pick a time that suits you. We’ll call or WhatsApp to confirm.</DialogDescription>
            </DialogHeader>
            <TrialForm site={site} whatsapp={whatsapp} />
          </DialogContent>
        </Dialog>
      )}
    </BookingContext.Provider>
  );
}

/** Opens the trial dialog; when trials are switched off it becomes a WhatsApp link (or disappears). */
export function TrialButton({ children, tone = "brand", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  const { open, whatsapp } = React.useContext(BookingContext);
  if (open)
    return (
      <button type="button" className={buttonTone(tone, className)} onClick={open}>
        {children}
      </button>
    );
  if (!whatsapp) return null;
  return (
    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonTone(tone, className)}>
      <BrandIcon name="whatsapp" className="size-[18px]" /> Message us
    </a>
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
        setResult({ ok: false, error: "Your request didn’t go through. Check your connection and try again." });
        notify.error("Could not send the request");
      }
    });
  }
  if (result?.ok)
    return (
      <motion.div
        role="status"
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gs-chalk px-6 py-10 text-center text-gs-ink"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand text-brand-ink">
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <h3 className="gs-display mt-5 text-3xl">You’re on the list</h3>
        <p className="mt-2 text-sm text-gs-steel">{result.message}</p>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonTone("ink", "mt-6")}>
            <BrandIcon name="whatsapp" className="size-[18px] text-[#25D366]" /> Continue on WhatsApp
          </a>
        )}
      </motion.div>
    );
  const errors = !result?.ok ? result?.fieldErrors : undefined;
  return (
    <form onSubmit={submit} className="grid gap-4 text-gs-ink">
      <input type="hidden" name="site" value={site} />
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="site-company">Company</label>
        <input id="site-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required error={errors?.name}>
          <Input name="name" autoComplete="name" required maxLength={128} placeholder="Full name" className="h-12 rounded-xl bg-white" />
        </Field>
        <Field label="Mobile number" required error={errors?.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" className="h-12 rounded-xl bg-white" />
        </Field>
      </div>
      <Field label="What are you training for?" required error={errors?.goal}>
        <select
          name="goal"
          required
          defaultValue=""
          className="h-12 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
        >
          <option value="" disabled>
            Choose a goal
          </option>
          {["Weight loss", "Muscle gain", "General fitness", "Strength", "Sports", "Other"].map((goal) => (
            <option key={goal}>{goal}</option>
          ))}
        </select>
      </Field>
      <Field label="Preferred day and time" optional error={errors?.trialAt} hint="India Standard Time">
        <Input name="trialAt" type="datetime-local" className="h-12 rounded-xl bg-white" />
      </Field>
      <label className="flex items-start gap-3 text-sm text-gs-steel">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 accent-[var(--brand)]" />
        <span>You can call or WhatsApp me about my trial and memberships.</span>
      </label>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {result.error}
        </p>
      )}
      <Button type="submit" loading={pending} className="h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-brand-ink hover:brightness-110">
        Book my free trial
      </Button>
      <p className="text-center text-xs text-gs-steel">Free. No card, no commitment.</p>
    </form>
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

function subscribeMinute(callback: () => void) {
  const id = window.setInterval(callback, 60_000);
  return () => window.clearInterval(id);
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);
const serverSnapshot = () => null;

/** "Open now · closes 10 PM" — computed in IST on the client only. */
export function OpenState({ hours, className = "" }: { hours: NonNullable<GymSite["hours"]>; className?: string }) {
  const minute = React.useSyncExternalStore(subscribeMinute, minuteSnapshot, serverSnapshot);
  if (hours.length === 0 || minute === null) return <span className={className}>&nbsp;</span>;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(minute * 60_000);
  const day = DAY_NAMES.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  const now = Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const today = matchingHours(hours, day);
  const mins = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
  };
  const open = today ? mins(today.open) : -1;
  const close = today ? mins(today.close) : -1;
  const isOpen = open >= 0 && close >= 0 && (close < open ? now >= open || now < close : now >= open && now < close);
  const label = isOpen ? `Open now · until ${formatHours(today!.close)}` : today && now < open ? `Opens today at ${formatHours(today.open)}` : "Closed now";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`size-2 rounded-full ${isOpen ? "bg-[#4ade80] shadow-[0_0_0_4px_rgb(74_222_128/0.2)]" : "bg-current opacity-50"}`} />
      {label}
    </span>
  );
}

/** Photographic mosaic with a keyboard-friendly lightbox. */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const { themeStyle } = React.useContext(BookingContext);
  const step = (dir: number) => setSelected((v) => (v === null ? null : (v + dir + images.length) % images.length));
  const layout = ["md:col-span-7 md:row-span-2", "md:col-span-5", "md:col-span-5", "md:col-span-4", "md:col-span-4", "md:col-span-4"];
  return (
    <>
      <div className="grid auto-rows-[210px] grid-cols-2 gap-2.5 md:auto-rows-[250px] md:grid-cols-12 md:gap-3">
        {images.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            onClick={() => setSelected(index)}
            aria-label={`View photo ${index + 1} of ${images.length}`}
            className={`group relative overflow-hidden rounded-[18px] bg-gs-iron focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${index === 0 ? "col-span-2 row-span-2" : ""} ${layout[index % layout.length]}`}
          >
            <Image
              src={src}
              alt=""
              fill
              unoptimized
              sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : "(max-width: 768px) 50vw, 33vw"}
              className="object-cover object-[center_30%] transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
            />
          </button>
        ))}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          style={themeStyle}
          className="gs w-[96vw] max-w-6xl border-0 bg-black/95 p-0 text-white sm:max-w-6xl"
          showCloseButton
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{name} photos</DialogTitle>
            <DialogDescription>
              Photo {selected === null ? "" : selected + 1} of {images.length}. Use the arrow keys to move between photos.
            </DialogDescription>
          </DialogHeader>
          {selected !== null && (
            <div className="relative aspect-[3/2] max-h-[80dvh] w-full">
              <Image src={images[selected]} alt="" fill unoptimized sizes="96vw" className="object-contain" />
            </div>
          )}
          <div className="flex items-center justify-between gap-4 px-4 pb-4">
            <button
              type="button"
              aria-label="Previous photo"
              className="grid size-11 place-items-center rounded-full hover:bg-white/10"
              onClick={() => step(-1)}
            >
              <ArrowLeft className="size-5" />
            </button>
            <span className="text-sm text-white/70 tabular-nums">{selected === null ? "" : `${selected + 1} / ${images.length}`}</span>
            <button type="button" aria-label="Next photo" className="grid size-11 place-items-center rounded-full hover:bg-white/10" onClick={() => step(1)}>
              <ArrowRight className="size-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SiteAnchor({
  href,
  children,
  className = "",
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(href.slice(1));
        onNavigate?.();
        if (!target) return;
        event.preventDefault();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
        history.replaceState(null, "", href);
      }}
    >
      {children}
    </a>
  );
}

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

/** Transparent over the hero photo, solid chalk once the page scrolls. */
export function SiteHeader({
  name,
  logo,
  links,
  whatsapp,
  trialLabel,
}: {
  name: string;
  logo: string | null;
  links: { href: string; label: string }[];
  whatsapp: string | null;
  trialLabel: string | null;
}) {
  const scrolled = React.useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 24,
    () => false,
  );
  const [menu, setMenu] = React.useState(false);
  const solid = scrolled || menu;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,color,box-shadow] duration-300 ${solid ? "bg-gs-chalk/92 text-gs-ink shadow-[0_1px_0_var(--gs-line)] backdrop-blur-xl" : "text-white"}`}
    >
      <nav aria-label="Main" className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <SiteAnchor
          href="#top"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-brand"
          onNavigate={() => setMenu(false)}
        >
          {logo ? (
            <span
              className="relative size-9 shrink-0 overflow-hidden rounded-[10px] bg-white"
              style={isDefaultLogoUrl(logo) ? { background: "color-mix(in oklab, var(--brand) 22%, white)" } : undefined}
            >
              <Image src={logo} alt="" fill unoptimized sizes="36px" className={isDefaultLogoUrl(logo) ? "object-contain p-0.5" : "object-cover"} />
            </span>
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand text-sm font-extrabold text-brand-ink">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="gs-display truncate text-[22px] leading-none">{name}</span>
        </SiteAnchor>
        <div className="hidden items-center gap-8 text-[15px] font-medium lg:flex">
          {links.map((link) => (
            <SiteAnchor key={link.href} href={link.href} className="opacity-80 transition-opacity hover:opacity-100">
              {link.label}
            </SiteAnchor>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Message ${name} on WhatsApp`}
              className={`grid size-11 place-items-center rounded-full transition-colors ${solid ? "hover:bg-gs-ink/5" : "hover:bg-white/10"}`}
            >
              <BrandIcon name="whatsapp" className="size-5" />
            </a>
          )}
          {trialLabel && (
            <span className="hidden sm:contents">
              <TrialButton tone={solid ? "brand" : "light"} className="min-h-11 px-5 text-sm">
                {trialLabel}
              </TrialButton>
            </span>
          )}
          <button
            type="button"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            className="grid size-11 place-items-center rounded-full lg:hidden"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {menu && (
        <div className="border-t border-gs-line px-4 pt-2 pb-6 sm:px-6 lg:hidden">
          {links.map((link) => (
            <SiteAnchor key={link.href} href={link.href} onNavigate={() => setMenu(false)} className="gs-display block border-b border-gs-line py-4 text-3xl">
              {link.label}
            </SiteAnchor>
          ))}
          {trialLabel && (
            <div className="mt-5" onClick={() => setMenu(false)}>
              <TrialButton className="w-full">{trialLabel}</TrialButton>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

type Trainer = { name: string; role: string; photo: string | null; experience?: string; instagram?: string };

export function TrainerCards({ trainers, brand }: { trainers: Trainer[]; brand: string }) {
  const { open, whatsapp } = React.useContext(BookingContext);
  const contact = open ?? (whatsapp ? () => window.open(whatsapp, "_blank", "noopener") : undefined);
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {trainers.map((t, i) => (
        <ProfileCard
          key={`${t.name}-${i}`}
          avatarUrl={t.photo}
          name={t.name}
          title={t.role}
          handle={t.instagram?.replace(/^@/, "")}
          status={t.experience}
          brand={brand}
          contactText={open ? "Train with me" : "Message"}
          onContactClick={contact}
          className="mx-auto w-full max-w-[380px]"
        />
      ))}
    </div>
  );
}
