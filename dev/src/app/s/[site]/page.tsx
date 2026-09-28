import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  HeartPulse,
  LockKeyhole,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Users,
} from "lucide-react";
import { inr, fmtPhone, toE164 } from "@/lib/format";
import { mediaUrl, parseSite, resolveSite, safeBrandColor, sitePlans } from "@/lib/queries/site";
import { BookingProvider, CtaIcon, Gallery, HoursBadge, Reveal, SiteAnchor, TrialButton, TrialForm, WhatsAppIcon } from "@/components/site/interactions";
import type { GymSite, Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

const defaultFaqs = [
  { q: "Can I try the gym before joining?", a: "Yes. Book a free trial and our team will show you around and help you get started." },
  { q: "Do I need any experience?", a: "Not at all. Whether this is your first workout or your next chapter, we'll help you train at your own pace." },
  { q: "How do I choose a membership?", a: "Tell us your goals and schedule. Our team will help you find the right plan for you." },
];

function duration(plan: Plan) {
  if (plan.type === "pt" || plan.type === "sessions") return `${plan.sessions} ${plan.sessions === 1 ? "session" : "sessions"}`;
  const months = Math.round(plan.durationDays / 30);
  if (Math.abs(plan.durationDays - months * 30) <= 5 && months > 0) return `${months} ${months === 1 ? "month" : "months"}`;
  return `${plan.durationDays} days`;
}

function whatsappUrl(phone: string | null) {
  const normalized = toE164(phone);
  return normalized ? `https://wa.me/${normalized.slice(1)}` : null;
}

function mapUrl(site: GymSite, address: string | null, city: string | null) {
  if (site.mapUrl && /^https:\/\//i.test(site.mapUrl)) return site.mapUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, city].filter(Boolean).join(", "))}`;
}

export async function generateMetadata({ params }: PageProps<"/s/[site]">): Promise<Metadata> {
  const gym = await resolveSite((await params).site);
  if (!gym) return { title: "Gym not found", robots: { index: false, follow: false } };
  const site = parseSite(gym);
  const available = gym.status === "active" && gym.siteEnabled !== false;
  const title = [gym.name, site.tagline].filter(Boolean).join(" | ");
  return {
    title: { absolute: title },
    description: site.about || `Train with ${gym.name}${gym.city ? ` in ${gym.city}` : ""}. Explore memberships and book a free trial.`,
    robots: { index: available, follow: available },
    openGraph: { title, description: site.about || undefined, type: "website" },
  };
}

export default async function SitePage({ params }: PageProps<"/s/[site]">) {
  const key = (await params).site;
  const gym = await resolveSite(key);
  if (!gym) notFound();
  if (gym.status !== "active" || gym.siteEnabled === false) return <Unavailable name={gym.name} />;

  const site = parseSite(gym);
  const plans = await sitePlans(gym.$id);
  const brand = safeBrandColor(gym.brandColor);
  const logo = mediaUrl(gym.logoFileId, 120);
  const hero = mediaUrl(site.heroFileId, 1600);
  const gallery = (site.gallery ?? [])
    .filter(Boolean)
    .map((id) => mediaUrl(id, 1100))
    .filter((url): url is string => !!url);
  const whatsapp = whatsappUrl(gym.phone);
  const tagline = site.tagline?.trim() || `Find your stronger self at ${gym.name}`;
  const about = site.about?.trim() || `${gym.name} is a place to move with purpose, build strength, and feel your best.`;
  const amenities = site.amenities?.filter(Boolean).slice(0, 12) ?? [];
  const hours = site.hours?.filter((h) => h.days && h.open && h.close) ?? [];
  const faqs = site.faqs?.filter((f) => f.q && f.a) ?? [];
  const trainers = site.trainers?.filter((t) => t.name).slice(0, 8) ?? [];
  const luminance = brand
    ? [1, 3, 5]
        .map((index) => {
          const channel = parseInt(brand.slice(index, index + 2), 16) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
    : 0;
  const style = brand
    ? ({
        "--brand": brand,
        "--primary": brand,
        "--ring": brand,
        "--primary-foreground": luminance > 0.179 ? "#09090b" : "#ffffff",
        "--brand-ink": luminance > 0.179 ? "#09090b" : "#ffffff",
      } as CSSProperties)
    : undefined;
  const location = mapUrl(site, gym.address, gym.city);

  return (
    <div style={style} className="min-h-screen overflow-x-clip bg-background text-foreground">
      <BookingProvider site={key} whatsapp={whatsapp}>
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
          <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <SiteAnchor href="#top" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-3 focus-visible:outline-primary">
              <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-foreground text-sm font-black text-background">
                {logo ? (
                  <Image src={logo} alt={`${gym.name} logo`} fill unoptimized sizes="40px" className="object-cover" />
                ) : (
                  gym.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <span className="truncate text-sm font-extrabold tracking-tight sm:text-base">{gym.name}</span>
            </SiteAnchor>
            <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
              <SiteAnchor href="#about" className="hover:text-foreground">
                About
              </SiteAnchor>
              <SiteAnchor href="#plans" className="hover:text-foreground">
                Plans
              </SiteAnchor>
              {gallery.length > 0 && (
                <SiteAnchor href="#gallery" className="hover:text-foreground">
                  Gallery
                </SiteAnchor>
              )}
              <SiteAnchor href="#visit" className="hover:text-foreground">
                Visit us
              </SiteAnchor>
            </div>
            <div className="flex items-center gap-2">
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Chat with ${gym.name} on WhatsApp`}
                  className="anim-host grid size-11 place-items-center rounded-xl border border-border text-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-primary"
                >
                  <WhatsAppIcon />
                </a>
              )}
              <TrialButton className="hidden sm:inline-flex">
                Book free trial <CtaIcon />
              </TrialButton>
              <TrialButton className="px-3 text-xs sm:hidden">Free trial</TrialButton>
            </div>
          </nav>
        </header>

        <main id="top">
          <section className="relative isolate min-h-[620px] overflow-hidden bg-[#111416] text-white sm:min-h-[700px]">
            {hero && <Image src={hero} alt={`${gym.name} training space`} fill priority unoptimized sizes="100vw" className="object-cover opacity-45" />}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#111416] via-[#111416]/85 to-transparent" />
            <div
              aria-hidden
              className="absolute -top-32 -right-32 size-[500px] rounded-full opacity-25 blur-3xl motion-safe:animate-pulse"
              style={{ background: "var(--brand, #16a34a)" }}
            />
            <div
              aria-hidden
              className="absolute -bottom-56 left-1/3 size-[460px] rounded-full opacity-15 blur-3xl"
              style={{ background: "var(--brand, #16a34a)" }}
            />
            <div className="relative mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-5 pt-20 pb-24 sm:min-h-[700px] sm:px-8 lg:px-10">
              <Reveal>
                <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase backdrop-blur">
                  <span className="size-2 rounded-full bg-[var(--brand,#16a34a)]" />
                  {gym.city ? `Built for ${gym.city}` : "Your space to grow"}
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <h1 className="max-w-4xl text-5xl leading-[1.04] font-black tracking-[-0.06em] text-balance sm:text-7xl lg:text-[5.8rem]">{tagline}</h1>
              </Reveal>
              <Reveal delay={0.14}>
                <p className="mt-7 max-w-xl text-base leading-7 text-pretty text-white/75 sm:text-lg">{about}</p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-9 flex flex-wrap gap-3">
                  <TrialButton className="border-white bg-white px-6 text-zinc-950 hover:bg-white/90">
                    Book your free trial <ArrowRight className="size-4" />
                  </TrialButton>
                  <SiteAnchor
                    href="#plans"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-white"
                  >
                    Explore memberships <ArrowDown className="size-4" />
                  </SiteAnchor>
                </div>
              </Reveal>
              <Reveal delay={0.25}>
                <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-white/75">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[var(--brand,#4ade80)]" /> Expert guidance
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="size-4 text-[var(--brand,#4ade80)]" /> Welcoming community
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <HeartPulse className="size-4 text-[var(--brand,#4ade80)]" /> Progress at your pace
                  </span>
                </div>
              </Reveal>
            </div>
          </section>

          <section aria-label="Why train here" className="relative z-10 -mt-10 px-5 sm:px-8">
            <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-float)]">
                <p className="text-3xl font-black tracking-tight">₹0</p>
                <p className="mt-1 text-sm text-muted-foreground">To book your first trial</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-float)]">
                <p className="text-3xl font-black tracking-tight">{plans.length || "Flexible"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{plans.length ? "Membership options" : "Ways to get started"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-float)]">
                <p className="text-3xl font-black tracking-tight">{amenities.length || 6}</p>
                <p className="mt-1 text-sm text-muted-foreground">Training features to explore</p>
              </div>
            </div>
          </section>

          <section id="about" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
              <Reveal>
                <div>
                  <Eyebrow>More than a workout</Eyebrow>
                  <h2 className="mt-4 max-w-lg text-4xl font-bold tracking-[-0.045em] text-balance sm:text-5xl">A place to show up for yourself.</h2>
                  <p className="mt-6 max-w-xl text-base leading-8 text-pretty text-muted-foreground">{about}</p>
                  <div className="mt-7 flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 font-medium text-success-ink">
                      <Check className="size-4" /> All levels welcome
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-lime-soft px-4 py-2 font-medium text-lime-ink">
                      <Check className="size-4" /> Made for your goals
                    </span>
                  </div>
                </div>
              </Reveal>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {(amenities.length
                  ? amenities
                  : ["Certified trainers", "Cardio zone", "Free weights", "Personal training", "Locker rooms", "Diet guidance"]
                ).map((item, i) => (
                  <Reveal key={`${item}-${i}`} delay={Math.min(i * 0.04, 0.25)}>
                    <div className="anim-host group flex h-full min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1 sm:min-h-40">
                      <span className="grid size-11 place-items-center rounded-xl bg-success-soft text-success-ink">
                        {i % 4 === 0 ? (
                          <Dumbbell className="size-5" />
                        ) : i % 4 === 1 ? (
                          <HeartPulse className="size-5" />
                        ) : i % 4 === 2 ? (
                          <Target className="size-5" />
                        ) : (
                          <Users className="size-5" />
                        )}
                      </span>
                      <h3 className="mt-5 text-sm font-semibold sm:text-base">{item}</h3>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section id="plans" className="scroll-mt-24 bg-muted/55 px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto max-w-7xl">
              <Reveal>
                <Eyebrow>Memberships</Eyebrow>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-bold tracking-[-0.045em] text-balance sm:text-5xl">Find your fit.</h2>
                    <p className="mt-4 max-w-xl text-muted-foreground">A clear path forward, built around your goals and your schedule.</p>
                  </div>
                  <TrialButton variant="outline">
                    Ask about plans <ArrowRight className="size-4" />
                  </TrialButton>
                </div>
              </Reveal>
              {plans.length ? (
                <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {plans.map((plan, index) => (
                    <Reveal key={plan.$id} delay={Math.min(index * 0.08, 0.25)}>
                      <article
                        className={`relative flex h-full flex-col rounded-2xl border bg-card p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1 ${plan.featured ? "border-[var(--brand,#16a34a)] ring-1 ring-[var(--brand,#16a34a)]" : "border-border"}`}
                      >
                        {plan.featured && (
                          <span className="absolute -top-3 left-7 rounded-full bg-[var(--brand,#16a34a)] px-3 py-1 text-xs font-bold text-[var(--brand-ink,#ffffff)]">
                            Most popular
                          </span>
                        )}
                        <span className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{duration(plan)}</span>
                        <h3 className="mt-5 text-2xl font-bold">{plan.name}</h3>
                        <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                          {plan.description || "Everything you need to keep moving forward."}
                        </p>
                        {site.showPrices !== false && (
                          <div className="mt-6 border-t border-border pt-6">
                            <p className="text-4xl font-black tracking-tight">{inr(plan.price)}</p>
                            {plan.type === "duration" && plan.durationDays > 35 && (
                              <p className="mt-1 text-sm text-muted-foreground">About {inr(Math.round(plan.price / (plan.durationDays / 30)))}/month</p>
                            )}
                          </div>
                        )}
                        <ul className="mt-6 space-y-3 text-sm">
                          <li className="flex gap-2">
                            <Check className="size-4 shrink-0 text-success" /> Access to a motivating space
                          </li>
                          <li className="flex gap-2">
                            <Check className="size-4 shrink-0 text-success" /> Support from the team
                          </li>
                        </ul>
                        <div className="mt-auto pt-8">
                          <TrialButton className="w-full">
                            Enquire about this plan <ArrowRight className="size-4" />
                          </TrialButton>
                        </div>
                      </article>
                    </Reveal>
                  ))}
                </div>
              ) : (
                <Reveal>
                  <div className="mt-10 rounded-2xl border border-border bg-card p-8">
                    <p className="text-muted-foreground">Ask our team about memberships that fit your goals.</p>
                    <div className="mt-5">
                      <TrialButton>
                        Talk to our team <ArrowRight className="size-4" />
                      </TrialButton>
                    </div>
                  </div>
                </Reveal>
              )}
            </div>
          </section>

          {trainers.length > 0 && (
            <section id="trainers" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
              <div className="mx-auto max-w-7xl">
                <Reveal>
                  <Eyebrow>Our people</Eyebrow>
                  <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-balance sm:text-5xl">Guidance that moves you.</h2>
                </Reveal>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {trainers.map((trainer, i) => {
                    const photo = mediaUrl(trainer.photoFileId, 500);
                    return (
                      <Reveal key={`${trainer.name}-${i}`} delay={i * 0.06}>
                        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1">
                          <div className="relative grid aspect-[4/3] place-items-center bg-gradient-to-br from-success-soft to-muted text-5xl font-black text-success-ink">
                            {photo ? (
                              <Image src={photo} alt={trainer.name} fill unoptimized sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
                            ) : (
                              trainer.name.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div className="p-5">
                            <h3 className="text-lg font-bold">{trainer.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{trainer.role}</p>
                          </div>
                        </article>
                      </Reveal>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section id="gallery" className="scroll-mt-24 bg-muted/55 px-5 py-20 sm:px-8 lg:py-28">
              <div className="mx-auto max-w-7xl">
                <Reveal>
                  <Eyebrow>Inside the space</Eyebrow>
                  <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-balance sm:text-5xl">See where it happens.</h2>
                  <p className="mt-4 text-muted-foreground">A space that helps you feel ready to show up.</p>
                </Reveal>
                <Reveal className="mt-10">
                  <Gallery images={gallery} name={gym.name} />
                </Reveal>
              </div>
            </section>
          )}

          <section id="visit" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-2xl bg-[#171a1c] p-7 text-white sm:p-10">
                  <Eyebrow light>Plan your visit</Eyebrow>
                  <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em]">We’re ready when you are.</h2>
                  <div className="mt-8 flex items-center gap-3">
                    <Clock3 className="size-5 text-[var(--brand,#4ade80)]" />
                    <HoursBadge hours={hours} />
                  </div>
                  {hours.length > 0 ? (
                    <div className="mt-6 divide-y divide-white/15 border-y border-white/15">
                      {hours.map((row, i) => (
                        <div key={`${row.days}-${i}`} className="flex justify-between gap-4 py-4 text-sm">
                          <span className="font-semibold">{row.days}</span>
                          <span className="text-white/70">
                            {row.open} – {row.close}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-white/70">Contact us for today’s opening hours.</p>
                  )}
                  <div className="mt-8">
                    <TrialButton className="border-white bg-white text-zinc-950 hover:bg-white/90">
                      Book a visit <ArrowRight className="size-4" />
                    </TrialButton>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 sm:p-10">
                  <Eyebrow>Find us</Eyebrow>
                  <h3 className="mt-4 text-2xl font-bold">Come by and say hello.</h3>
                  <div className="mt-8 flex gap-3">
                    <MapPin className="mt-1 size-5 shrink-0 text-primary" />
                    <p className="max-w-sm leading-7 text-muted-foreground">{gym.address || gym.city || "Contact us for directions"}</p>
                  </div>
                  {gym.phone && (
                    <a
                      href={`tel:${toE164(gym.phone) ?? gym.phone}`}
                      className="mt-5 flex min-h-11 items-center gap-3 text-sm font-semibold hover:text-primary"
                    >
                      <MessageCircle className="size-5 text-primary" />
                      {fmtPhone(gym.phone)}
                    </a>
                  )}
                  <div className="mt-auto pt-10">
                    <a
                      href={location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-muted focus-visible:outline-3 focus-visible:outline-primary"
                    >
                      Get directions <ArrowRight className="size-4" />
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <section id="faq" className="scroll-mt-24 bg-muted/55 px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto max-w-4xl">
              <Reveal>
                <Eyebrow>Good to know</Eyebrow>
                <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] text-balance sm:text-5xl">Questions, answered.</h2>
              </Reveal>
              <div className="mt-9 space-y-3">
                {(faqs.length ? faqs : defaultFaqs).map((faq, i) => (
                  <Reveal key={`${faq.q}-${i}`} delay={i * 0.04}>
                    <details className="group rounded-2xl border border-border bg-card px-5 py-1 open:shadow-[var(--shadow-card)]">
                      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold marker:hidden focus-visible:outline-3 focus-visible:outline-primary">
                        {faq.q}
                        <span className="text-2xl font-light text-primary transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <p className="pr-8 pb-5 text-sm leading-7 text-muted-foreground">{faq.a}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section id="trial" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
            <div className="mx-auto grid max-w-7xl gap-10 rounded-3xl bg-[#15191b] p-6 text-white sm:p-10 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:p-16">
              <Reveal>
                <Eyebrow light>Your next move</Eyebrow>
                <h2 className="mt-5 max-w-xl text-4xl font-black tracking-[-0.05em] text-balance sm:text-6xl">Start with one great workout.</h2>
                <p className="mt-6 max-w-lg leading-7 text-white/70">
                  Meet the team, explore the space, and find your rhythm. Your free trial is one simple step away.
                </p>
                <div className="mt-9 flex flex-wrap gap-4 text-sm text-white/70">
                  <span className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--brand,#4ade80)]" /> No commitment
                  </span>
                  <span className="flex items-center gap-2">
                    <Timer className="size-4 text-[var(--brand,#4ade80)]" /> Takes a minute
                  </span>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="rounded-2xl bg-card p-5 text-foreground shadow-2xl sm:p-7">
                  <h3 className="text-xl font-bold">Book your free trial</h3>
                  <p className="mt-1 mb-6 text-sm text-muted-foreground">We’ll contact you to confirm the details.</p>
                  <TrialForm site={key} whatsapp={whatsapp} />
                </div>
              </Reveal>
            </div>
          </section>
        </main>

        <footer className="border-t border-border px-5 py-10 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8">
            <div>
              <p className="text-lg font-extrabold">{gym.name}</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{tagline}</p>
              <p className="mt-5 text-xs text-muted-foreground">Powered by GymOS</p>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-4 text-sm text-muted-foreground">
              <SiteAnchor href="#about" className="hover:text-foreground">
                About
              </SiteAnchor>
              <SiteAnchor href="#plans" className="hover:text-foreground">
                Plans
              </SiteAnchor>
              <SiteAnchor href="#visit" className="hover:text-foreground">
                Visit
              </SiteAnchor>
              {site.socials?.instagram && (
                <a href={site.socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  Instagram
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="hover:text-foreground">
                  <MessageCircle className="size-5" />
                </a>
              )}
            </div>
          </div>
        </footer>
      </BookingProvider>
    </div>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`text-xs font-extrabold tracking-[0.2em] uppercase ${light ? "text-[#9ee8ad]" : "text-primary"}`}>{children}</p>;
}

function Unavailable({ name }: { name: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-muted">
          <LockKeyhole className="size-7 text-muted-foreground" />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Temporarily unavailable</h1>
        <p className="mt-3 leading-7 text-muted-foreground">The website for {name} is taking a short break. Please check back soon.</p>
      </div>
    </main>
  );
}
