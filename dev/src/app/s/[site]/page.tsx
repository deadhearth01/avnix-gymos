import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowUpRight, MapPin, Phone } from "@/components/icons";
import { LogoMark } from "@/components/brand/logo";
import { BrandIcon, type BrandIconName } from "@/components/brand/social-icons";
import { amenityIcon } from "@/components/site/amenity-icon";
import { BookingProvider, Gallery, OpenState, SiteAnchor, SiteHeader, TrainerCards, TrialButton, TrialForm } from "@/components/site/interactions";
import { buttonTone, formatHours } from "@/components/site/tone";
import { fmtPhone, inr, toE164 } from "@/lib/format";
import { mediaUrl, parseSite, resolveSite, safeBrandColor, sitePlans } from "@/lib/queries/site";
import { defaultLogoFor, preset, presetUrl } from "@/lib/site/presets";
import { siteUrl } from "@/lib/site/url";
import type { Gym, GymSite, Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_FAQS = [
  {
    q: "Can I try the gym before I join?",
    a: "Yes. Book a free trial session and a coach will walk you through the floor and plan your first workout with you.",
  },
  {
    q: "I’ve never trained before. Is that a problem?",
    a: "Not at all. Most of our members started as beginners. Your coach sets the pace and teaches every movement properly.",
  },
  {
    q: "Which membership should I pick?",
    a: "Tell us your goal and how often you can come in. We’ll suggest the plan that gives you the best value for that routine.",
  },
];

const DEFAULT_AMENITIES = ["Free weights & racks", "Cardio deck", "Certified coaches", "Personal training", "Locker rooms", "Diet guidance"];

function planLength(plan: Plan) {
  if (plan.type !== "duration") return `${plan.sessions} ${plan.sessions === 1 ? "session" : "sessions"}`;
  const months = Math.round(plan.durationDays / 30);
  if (months >= 12 && months % 12 === 0) return months === 12 ? "12 months" : `${months / 12} years`;
  if (months > 0 && Math.abs(plan.durationDays - months * 30) <= 5) return `${months} ${months === 1 ? "month" : "months"}`;
  return `${plan.durationDays} days`;
}

function whatsappUrl(phone: string | null) {
  const normalized = toE164(phone);
  return normalized ? `https://wa.me/${normalized.slice(1)}` : null;
}

function directionsUrl(site: GymSite, gym: Gym) {
  if (site.mapUrl && /^https:\/\//i.test(site.mapUrl)) return site.mapUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([gym.name, gym.address, gym.city].filter(Boolean).join(", "))}`;
}

/** Relative bundled paths ("/site-defaults/…") → absolute URLs for search engines. */
function absolute(path: string | null | undefined, base: string) {
  return path ? (path.startsWith("/") ? `${base}${path}` : path) : undefined;
}

function safeLink(value: string | undefined) {
  return value && /^https:\/\//i.test(value) ? value : null;
}

function contrastInk(hex: string) {
  const lum = [1, 3, 5]
    .map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return lum > 0.4 ? "#17181c" : "#ffffff";
}

const thisYear = () => new Date().getFullYear();

export async function generateMetadata({ params }: PageProps<"/s/[site]">): Promise<Metadata> {
  const gym = await resolveSite((await params).site);
  if (!gym) return { title: { absolute: "Gym not found" }, robots: { index: false, follow: false } };
  const site = parseSite(gym);
  const live = gym.status === "active" && gym.siteEnabled !== false;
  const url = siteUrl(gym);
  const place = gym.city ? ` in ${gym.city}` : "";
  const title = `${gym.name} — Gym${place}${site.tagline ? ` | ${site.tagline}` : ""}`.slice(0, 90);
  const description = (
    site.heroText ||
    site.about ||
    `${gym.name} is a gym${place} with coaching, strength and cardio training. See memberships and personal training rates, and book a free trial.`
  ).slice(0, 180);
  const logo = mediaUrl(gym.logoFileId, 256) ?? presetUrl(defaultLogoFor(gym.$id));
  return {
    metadataBase: new URL(url),
    title: { absolute: title },
    description,
    applicationName: gym.name,
    alternates: { canonical: url },
    robots: live ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } } : { index: false, follow: false },
    openGraph: {
      type: "website",
      url,
      siteName: gym.name,
      title,
      description,
      locale: "en_IN",
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: `${gym.name}${place}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${url}/opengraph-image`] },
    icons: logo ? { icon: logo, apple: logo } : undefined,
    keywords: [gym.name, `gym${place}`, `fitness centre${place}`, `personal trainer${place}`, gym.city ? `gym near me ${gym.city}` : "gym near me"].filter(
      Boolean,
    ),
    other: gym.city ? { "geo.placename": gym.city, "geo.region": "IN" } : undefined,
  };
}

function jsonLd(gym: Gym, site: GymSite, plans: Plan[], url: string, image: string | null, showPrices: boolean) {
  const days: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const order = Object.keys(days);
  const hours = (site.hours ?? []).flatMap((row) => {
    const label = row.days.toLowerCase().replace(/[–—]/g, "-");
    let list: string[] = [];
    if (/daily|every ?day|all days/.test(label)) list = order;
    else {
      const range = label.split("-").map((p) => order.findIndex((d) => p.trim().startsWith(d)));
      if (range.length === 2 && range.every((n) => n >= 0)) {
        for (let i = range[0]; ; i = (i + 1) % 7) {
          list.push(order[i]);
          if (i === range[1] || list.length > 7) break;
        }
      } else
        list = label
          .split(/[,/&]/)
          .map((p) => order.find((d) => p.trim().startsWith(d)) ?? "")
          .filter(Boolean);
    }
    return list.length ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: list.map((d) => days[d]), opens: row.open, closes: row.close }] : [];
  });
  const sameAs = Object.values(site.socials ?? {}).filter((v): v is string => !!safeLink(v));
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    "@id": `${url}/#gym`,
    name: gym.name,
    url,
    description: site.about || site.heroText || undefined,
    telephone: toE164(gym.phone) ?? undefined,
    email: gym.email ?? undefined,
    image: image ?? undefined,
    logo: absolute(mediaUrl(gym.logoFileId, 512) ?? presetUrl(defaultLogoFor(gym.$id)), url),
    address:
      gym.address || gym.city
        ? { "@type": "PostalAddress", streetAddress: gym.address ?? undefined, addressLocality: gym.city ?? undefined, addressCountry: "IN" }
        : undefined,
    hasMap: site.mapUrl && /^https:\/\//i.test(site.mapUrl) ? site.mapUrl : undefined,
    openingHoursSpecification: hours.length ? hours : undefined,
    amenityFeature: (site.amenities ?? []).map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    sameAs: sameAs.length ? sameAs : undefined,
    currenciesAccepted: "INR",
    paymentAccepted: "Cash, UPI, Card",
  };
  if (showPrices && plans.length) {
    const prices = plans.map((p) => p.price).filter((p) => p > 0);
    if (prices.length) data.priceRange = `${inr(Math.min(...prices))} – ${inr(Math.max(...prices))}`;
    data.makesOffer = plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      description: p.description ?? undefined,
      price: p.price,
      priceCurrency: "INR",
      url: `${url}/#plans`,
    }));
  }
  // `<` is escaped so owner-written text can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function SitePage({ params }: PageProps<"/s/[site]">) {
  const key = (await params).site;
  const gym = await resolveSite(key);
  if (!gym) notFound();
  if (gym.status !== "active" || gym.siteEnabled === false) return <Unavailable name={gym.name} />;

  const site = parseSite(gym);
  const plans = await sitePlans(gym.$id);
  const brand = safeBrandColor(gym.brandColor) ?? "#16a34a";
  const brandInk = contrastInk(brand);
  const themeStyle = { "--brand": brand, "--brand-ink": brandInk } as CSSProperties;
  const url = siteUrl(gym);
  const showPrices = site.showPrices !== false;
  const showTrial = site.showTrial !== false;

  const logo = mediaUrl(gym.logoFileId, 120) ?? presetUrl(defaultLogoFor(gym.$id));
  const hero = mediaUrl(site.heroFileId || preset("hero-deadlift"), 2000)!;
  const photos = (site.gallery ?? []).map((id) => mediaUrl(id, 1400)).filter((u): u is string => !!u);
  // With enough photos, the last one moves up beside the intro instead of repeating in the gallery.
  const sidePhoto = photos.length >= 4 ? photos[photos.length - 1] : mediaUrl(preset("weights-rack"), 1000)!;
  const gallery = photos.length >= 4 ? photos.slice(0, -1) : photos;
  const ptPhoto = mediaUrl(preset("pt-session"), 900)!;
  const closingPhoto = mediaUrl(preset("community"), 2000)!;
  const whatsapp = whatsappUrl(gym.phone);
  const headline = site.tagline?.trim() || `Train hard. Train right.`;
  const heroText =
    site.heroText?.trim() || `Coaching, serious equipment and people who notice when you don’t show up.${gym.city ? ` Right here in ${gym.city}.` : ""}`;
  const about =
    site.about?.trim() || `${gym.name} is a neighbourhood gym built for steady progress — good coaching, clean equipment and a floor where everyone belongs.`;
  const amenities = site.amenities?.filter(Boolean).slice(0, 12) ?? [];
  const hours = site.hours?.filter((h) => h.days && h.open && h.close) ?? [];
  const faqs = site.faqs?.filter((f) => f.q && f.a) ?? [];
  const trainers = (site.trainers ?? []).filter((t) => t.name).slice(0, 6);
  const memberships = plans.filter((p) => p.type === "duration");
  const training = plans.filter((p) => p.type !== "duration");
  const directions = directionsUrl(site, gym);
  const socials = (
    [
      ["instagram", site.socials?.instagram, "Instagram"],
      ["facebook", site.socials?.facebook, "Facebook"],
      ["youtube", site.socials?.youtube, "YouTube"],
      ["google", site.socials?.google, "Google reviews"],
    ] as [BrandIconName, string | undefined, string][]
  ).flatMap(([icon, href, label]) => (safeLink(href) ? [{ icon, href: href!, label }] : []));

  const links = [
    { href: "#about", label: "The gym" },
    { href: "#plans", label: showPrices ? "Plans & prices" : "Memberships" },
    ...(trainers.length ? [{ href: "#coaches", label: "Coaches" }] : []),
    { href: "#visit", label: "Visit" },
  ];

  return (
    <div style={themeStyle} className="gs min-h-dvh overflow-x-clip bg-gs-chalk text-gs-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(gym, site, plans, url, hero.startsWith("/") ? `${url}${hero}` : hero, showPrices) }}
      />
      <BookingProvider site={key} whatsapp={whatsapp} trial={showTrial} themeStyle={themeStyle}>
        <SiteHeader name={gym.name} logo={logo} links={links} whatsapp={whatsapp} trialLabel={showTrial ? "Free trial" : null} />

        <main id="top">
          {/* Hero — the photo does the talking */}
          <section className="relative isolate flex min-h-[max(640px,100svh)] flex-col justify-end overflow-hidden bg-gs-iron text-white">
            <Image
              src={hero}
              alt={`Training at ${gym.name}`}
              fill
              priority
              unoptimized
              sizes="100vw"
              className="gs-hero-photo -z-20 object-cover object-[70%_center]"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(10_11_14/0.82)_0%,rgb(10_11_14/0.55)_45%,rgb(10_11_14/0.05)_80%)]"
            />
            <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[linear-gradient(0deg,rgb(10_11_14/0.85),transparent)]" />
            <div className="mx-auto w-full max-w-[1320px] px-4 pt-32 pb-10 sm:px-6 lg:px-10 lg:pb-14">
              <h1 className="gs-display gs-rise max-w-[11ch] text-[clamp(3.6rem,11vw,9.5rem)] text-balance">{headline}</h1>
              <p className="gs-rise mt-6 max-w-[46ch] text-[17px] leading-relaxed text-white/80 sm:text-lg" style={{ "--d": "120ms" } as CSSProperties}>
                {heroText}
              </p>
              <div className="gs-rise mt-9 flex flex-wrap gap-3" style={{ "--d": "220ms" } as CSSProperties}>
                {showTrial ? (
                  <TrialButton>Book a free trial</TrialButton>
                ) : (
                  whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonTone("brand")}>
                      <BrandIcon name="whatsapp" className="size-[18px]" /> Message us
                    </a>
                  )
                )}
                <SiteAnchor href="#plans" className={buttonTone("outline-light")}>
                  {showPrices ? "See plans & prices" : "See memberships"}
                </SiteAnchor>
              </div>
              <div
                className="gs-rise mt-14 flex flex-col gap-x-10 gap-y-3 border-t border-white/20 pt-5 text-sm text-white/75 sm:flex-row sm:items-center"
                style={{ "--d": "320ms" } as CSSProperties}
              >
                {hours.length > 0 && <OpenState hours={hours} className="font-medium text-white" />}
                {(gym.address || gym.city) && (
                  <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                    <MapPin className="size-4" /> {[gym.address, gym.city].filter(Boolean).join(", ")}
                  </a>
                )}
                {gym.phone && (
                  <a href={`tel:${toE164(gym.phone) ?? gym.phone}`} className="inline-flex items-center gap-2 hover:text-white sm:ml-auto">
                    <Phone className="size-4" /> {fmtPhone(gym.phone)}
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* The gym */}
          <section id="about" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
            <div className="mx-auto grid max-w-[1320px] gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
              <div>
                <h2 className="gs-display text-[clamp(2.8rem,6vw,5.2rem)]">The gym</h2>
                <p className="mt-8 max-w-[34ch] text-[clamp(1.35rem,2.2vw,1.85rem)] leading-snug font-medium tracking-[-0.01em] text-pretty">{about}</p>
                <ul className="mt-14 grid gap-x-10 sm:grid-cols-2">
                  {(amenities.length ? amenities : DEFAULT_AMENITIES).map((item, i) => {
                    const Icon = amenityIcon(item);
                    return (
                      <li key={`${item}-${i}`} className="flex items-center gap-4 border-t border-gs-line py-4">
                        <Icon className="size-[22px] shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
                        <span className="text-[16px] font-medium">{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="relative min-h-[420px] overflow-hidden rounded-[24px] lg:min-h-0">
                <Image src={sidePhoto} alt={`Equipment at ${gym.name}`} fill unoptimized sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
              </div>
            </div>
          </section>

          {/* Plans & personal training */}
          <section id="plans" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
            <div className="mx-auto max-w-[1320px]">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <h2 className="gs-display text-[clamp(2.8rem,6vw,5.2rem)]">{showPrices ? "Plans & prices" : "Memberships"}</h2>
                <p className="max-w-[40ch] text-gs-steel">
                  {showPrices
                    ? "Prices include GST. Longer plans cost less per month."
                    : "Ask us for current rates — we’ll match a plan to how often you can train."}
                </p>
              </div>

              <div className="mt-12 grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-10">
                <div>
                  {memberships.length ? (
                    <ul className="border-b border-gs-line">
                      {memberships.map((plan) => {
                        const months = plan.durationDays / 30;
                        return (
                          <li
                            key={plan.$id}
                            className={`grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 border-t border-gs-line py-6 sm:grid-cols-[1fr_120px_150px] ${plan.featured ? "relative before:absolute before:inset-y-3 before:-left-4 before:w-1 before:rounded-full before:bg-brand sm:before:-left-5" : ""}`}
                          >
                            <div className="min-w-0">
                              <h3 className="text-xl font-semibold tracking-[-0.01em]">
                                {plan.name}
                                {plan.featured && <span className="ml-3 align-middle text-sm font-semibold text-brand">Most chosen</span>}
                              </h3>
                              {plan.description && <p className="mt-1 max-w-[46ch] text-sm text-gs-steel">{plan.description}</p>}
                            </div>
                            <p className="text-sm text-gs-steel max-sm:order-3 max-sm:col-span-2">{planLength(plan)}</p>
                            {showPrices ? (
                              <div className="text-right">
                                <p className="gs-display text-[2.6rem] leading-none">{inr(plan.price)}</p>
                                {months > 1.5 && <p className="mt-1 text-xs text-gs-steel">{inr(Math.round(plan.price / months))} a month</p>}
                              </div>
                            ) : (
                              <TrialButton tone="outline" className="min-h-10 justify-self-end px-4 text-sm">
                                Ask
                              </TrialButton>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="border-y border-gs-line py-8 text-lg text-gs-steel">Our team will help you pick a membership that fits your week.</p>
                  )}
                  {plans.some((p) => p.joiningFee > 0) && showPrices && (
                    <p className="mt-4 text-sm text-gs-steel">A one-time joining fee applies to new members — ask us about waivers on longer plans.</p>
                  )}
                </div>

                <aside className="overflow-hidden rounded-[24px] bg-gs-iron text-white">
                  <div className="relative h-52">
                    <Image
                      src={ptPhoto}
                      alt="A coach guiding a member through a squat"
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 35vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-7 sm:p-8">
                    <h3 className="gs-display text-4xl">Personal training</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/65">
                      One coach, your programme, every rep checked. Sessions are booked around your schedule.
                    </p>
                    {training.length ? (
                      <ul className="mt-6">
                        {training.map((plan) => (
                          <li key={plan.$id} className="flex items-baseline justify-between gap-4 border-t border-white/12 py-4">
                            <span>
                              <span className="block font-semibold">{plan.name}</span>
                              {!plan.name.includes(String(plan.sessions)) && <span className="text-sm text-white/55">{planLength(plan)}</span>}
                            </span>
                            {showPrices && (
                              <span className="text-right">
                                <span className="gs-display block text-3xl leading-none">{inr(plan.price)}</span>
                                {plan.sessions > 1 && (
                                  <span className="block text-xs whitespace-nowrap text-white/55">{inr(Math.round(plan.price / plan.sessions))} a session</span>
                                )}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-6 border-t border-white/12 pt-4 text-sm text-white/65">Ask at the front desk for coaching packages.</p>
                    )}
                    <div className="mt-6">
                      <TrialButton tone="light" className="w-full">
                        {showTrial ? "Try a session free" : "Ask about coaching"}
                      </TrialButton>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          {trainers.length > 0 && (
            <section id="coaches" className="scroll-mt-20 bg-gs-iron px-4 py-24 text-white sm:px-6 lg:px-10 lg:py-32">
              <div className="mx-auto max-w-[1320px]">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <h2 className="gs-display text-[clamp(2.8rem,6vw,5.2rem)]">Your coaches</h2>
                  <p className="max-w-[40ch] text-white/60">
                    Every new member gets a coach for their first month — form checks, a starter plan and someone to ask.
                  </p>
                </div>
                <div className="mt-14">
                  <TrainerCards
                    brand={brand}
                    trainers={trainers.map((t) => ({
                      name: t.name,
                      role: t.role,
                      experience: t.experience,
                      instagram: t.instagram,
                      photo: mediaUrl(t.photoFileId, 800),
                    }))}
                  />
                </div>
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section id="gallery" aria-label="Photos" className="scroll-mt-20 px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
              <div className="mx-auto max-w-[1320px]">
                <h2 className="gs-display mb-12 text-[clamp(2.8rem,6vw,5.2rem)]">Inside {gym.name}</h2>
                <Gallery images={gallery} name={gym.name} />
              </div>
            </section>
          )}

          {/* Visit */}
          <section id="visit" className={`scroll-mt-20 px-4 py-24 sm:px-6 lg:px-10 lg:py-32 ${gallery.length ? "bg-white" : ""}`}>
            <div className="mx-auto grid max-w-[1320px] gap-14 lg:grid-cols-2 lg:gap-20">
              <div>
                <h2 className="gs-display text-[clamp(2.8rem,6vw,5.2rem)]">Come by</h2>
                <address className="mt-8 max-w-[30ch] text-2xl leading-snug font-medium not-italic">
                  {[gym.address, gym.city].filter(Boolean).join(", ") || "Message us for directions"}
                </address>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonTone("ink")}>
                    <BrandIcon name="googlemaps" className="size-[18px]" /> Get directions
                  </a>
                  {whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonTone("outline")}>
                      <BrandIcon name="whatsapp" className="size-[18px] text-[#25D366]" /> WhatsApp
                    </a>
                  )}
                  {gym.phone && (
                    <a href={`tel:${toE164(gym.phone) ?? gym.phone}`} className={buttonTone("outline")}>
                      <Phone className="size-[18px]" /> Call
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-semibold">Opening hours</h3>
                  {hours.length > 0 && <OpenState hours={hours} className="text-sm font-medium text-gs-steel" />}
                </div>
                {hours.length ? (
                  <dl className="mt-5 border-b border-gs-line">
                    {hours.map((row, i) => (
                      <div key={`${row.days}-${i}`} className="flex justify-between gap-6 border-t border-gs-line py-4 text-[17px]">
                        <dt className="font-medium">{row.days}</dt>
                        <dd className="text-gs-steel tabular-nums">
                          {formatHours(row.open)} – {formatHours(row.close)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-5 border-y border-gs-line py-5 text-gs-steel">Call or WhatsApp us for today’s timings.</p>
                )}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className={`scroll-mt-20 px-4 py-24 sm:px-6 lg:px-10 lg:py-32 ${gallery.length ? "" : "bg-white"}`}>
            <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <h2 className="gs-display text-[clamp(2.8rem,6vw,5.2rem)] lg:sticky lg:top-28 lg:self-start">Before you ask</h2>
              <div className="border-b border-gs-line">
                {(faqs.length ? faqs : DEFAULT_FAQS).map((faq, i) => (
                  <details key={`${faq.q}-${i}`} className="group border-t border-gs-line">
                    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <span
                        aria-hidden
                        className="relative size-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-current after:transition-transform group-open:after:scale-y-0"
                      />
                    </summary>
                    <p className="max-w-[62ch] pb-6 leading-relaxed text-gs-steel">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Closing call to action */}
          <section id="trial" className="relative isolate scroll-mt-20 overflow-hidden bg-gs-iron px-4 py-24 text-white sm:px-6 lg:px-10 lg:py-32">
            <Image src={closingPhoto} alt="" fill unoptimized sizes="100vw" className="-z-20 object-cover opacity-45" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(10_11_14/0.9),rgb(10_11_14/0.55))]" />
            <div className={`mx-auto grid max-w-[1320px] gap-12 ${showTrial ? "lg:grid-cols-[1fr_minmax(0,480px)] lg:items-center lg:gap-20" : ""}`}>
              <div>
                <h2 className="gs-display max-w-[12ch] text-[clamp(3rem,7.5vw,6.5rem)] text-balance">
                  {showTrial ? "Your first session is on us" : "Start this week"}
                </h2>
                <p className="mt-6 max-w-[42ch] text-lg text-white/75">
                  {showTrial
                    ? "Come in, meet a coach, and train. If it feels right, we’ll help you choose a plan. If not, no hard feelings."
                    : "Drop in, look around and talk to a coach. We’ll help you choose a plan that fits your week."}
                </p>
                {!showTrial && (
                  <div className="mt-9 flex flex-wrap gap-3">
                    {whatsapp && (
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonTone("brand")}>
                        <BrandIcon name="whatsapp" className="size-[18px]" /> Message us
                      </a>
                    )}
                    {gym.phone && (
                      <a href={`tel:${toE164(gym.phone) ?? gym.phone}`} className={buttonTone("outline-light")}>
                        <Phone className="size-[18px]" /> {fmtPhone(gym.phone)}
                      </a>
                    )}
                  </div>
                )}
              </div>
              {showTrial && (
                <div className="rounded-[24px] bg-gs-chalk p-6 text-gs-ink sm:p-8">
                  <TrialForm site={key} whatsapp={whatsapp} />
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="bg-gs-ink px-4 pt-20 pb-8 text-white sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1320px]">
            <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <p className="gs-display text-[clamp(2.6rem,5vw,4rem)]">{gym.name}</p>
                <p className="mt-4 max-w-[36ch] text-white/60">{headline}</p>
              </div>
              <div className="text-sm leading-relaxed text-white/70">
                <p className="mb-3 font-semibold text-white">Find us</p>
                <p>{[gym.address, gym.city].filter(Boolean).join(", ") || "—"}</p>
                {gym.phone && (
                  <a href={`tel:${toE164(gym.phone) ?? gym.phone}`} className="mt-2 block hover:text-white">
                    {fmtPhone(gym.phone)}
                  </a>
                )}
                {gym.email && (
                  <a href={`mailto:${gym.email}`} className="block break-all hover:text-white">
                    {gym.email}
                  </a>
                )}
              </div>
              <div className="text-sm text-white/70">
                <p className="mb-3 font-semibold text-white">Follow along</p>
                <div className="flex flex-wrap gap-2">
                  {whatsapp && <SocialLink href={whatsapp} icon="whatsapp" label="WhatsApp" />}
                  {socials.map((s) => (
                    <SocialLink key={s.icon} href={s.href} icon={s.icon} label={s.label} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
              <p>
                © {thisYear()} {gym.name}
              </p>
              <a
                href="https://gym.avnix.in"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 text-white/60 transition-colors hover:text-white"
                aria-label="Powered by AvniX GymOS"
              >
                <span>Powered by</span>
                <LogoMark className="size-4" title="" />
                <span className="font-semibold text-white/80">AvniX GymOS</span>
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </footer>
      </BookingProvider>
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: BrandIconName; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-white/50 hover:text-white"
    >
      <BrandIcon name={icon} className="size-[18px]" />
    </a>
  );
}

function Unavailable({ name }: { name: string }) {
  return (
    <main className="gs grid min-h-dvh place-items-center bg-gs-chalk px-5 text-center text-gs-ink">
      <div className="max-w-md">
        <h1 className="gs-display text-6xl">Back soon</h1>
        <p className="mt-4 leading-relaxed text-gs-steel">The {name} website is offline for a short while. Please check back later.</p>
      </div>
    </main>
  );
}
