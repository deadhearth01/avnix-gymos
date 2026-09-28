import Image from "next/image";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], display: "swap", weight: ["500", "700"] });

const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || "jagadeeshp@theavni.studio";
const DEMO_MAIL = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("GymOS demo for my gym")}&body=${encodeURIComponent("Gym name:\nCity:\nNumber of members (approx.):\nBest time to call:\n")}`;
const DEMO_SITE = "https://ironparadise.gym.avnix.in";

const DAY = [
  {
    time: "5:30 AM",
    title: "Members check themselves in",
    body: "Each member has a QR code on their phone. They scan it at the desk, and you see who walked in — and whose plan has run out — before they reach the floor.",
    doodle: "front-desk-scan",
    note: "no more flipping pages",
  },
  {
    time: "9:00 AM",
    title: "Renewal reminders go out on WhatsApp",
    body: "Three days before a plan ends, GymOS sends a polite reminder in Telugu or English, with the amount and a UPI link. Nobody at the desk has to make awkward calls.",
    doodle: "whatsapp-reminder",
    note: "sent before you’ve had chai",
  },
  {
    time: "11:00 AM",
    title: "Payments become GST invoices",
    body: "Cash, UPI or card — record it in two taps. A numbered GST invoice (5%, SAC 999723) is created and shared with the member automatically.",
    doodle: "gst-invoice",
    note: "your CA will thank you",
  },
  {
    time: "9:30 PM",
    title: "You see the day in one screen",
    body: "Collections, dues, check-ins, new enquiries and who is about to leave. From your phone, wherever you are.",
    doodle: "growth-chart",
    note: "closing time, sorted",
  },
] as const;

const FEATURES = [
  ["Members & plans", "Monthly, quarterly, yearly and session packs. Freeze, extend, transfer and renew without losing history."],
  ["Front desk", "QR check-in, walk-in lookup by name or phone, and a live list of who’s in the gym right now."],
  ["Billing & GST", "Invoices, part payments, dues and receipts. Exports your accountant can open."],
  ["Leads", "Trial bookings from your website, Instagram and walk-ins in one board, with follow-up reminders."],
  ["WhatsApp & SMS automations", "Renewals, birthdays, missed-you messages and payment receipts, in Telugu and English."],
  ["Staff & roles", "Owners, managers, front desk and trainers each see only what they need."],
  ["Finance", "Expenses, collections and profit by month, so you know what the gym actually earns."],
  ["Your own website", "A fast, search-friendly site for your gym with plans, coaches and trial booking."],
] as const;

const QUESTIONS = [
  [
    "We have years of data in a register and Excel. Do we start from zero?",
    "No. Send us your register photos or spreadsheet and we’ll import your members, plans and expiry dates before you go live.",
  ],
  ["Does my front desk staff need training?", "About twenty minutes. If they can use WhatsApp, they can use GymOS. We sit with your team on the first day."],
  [
    "Will WhatsApp messages come from my gym’s number?",
    "Yes. Messages are sent from a WhatsApp Business number registered for your gym, so members see your name.",
  ],
  ["What happens to my data if I stop?", "It’s yours. You can export members, payments and invoices to Excel at any time."],
] as const;

function Arrow({ className = "", d = "M4 40 C 40 8, 90 6, 132 26 M118 14 L133 27 L116 36" }: { className?: string; d?: string }) {
  return (
    <svg viewBox="0 0 140 48" fill="none" aria-hidden className={`mk-draw ${className}`}>
      <path d={d} pathLength={1} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BrowserFrame({ src, alt, url, priority = false }: { src: string; alt: string; url: string; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-[14px] border border-[var(--mk-rule)] bg-white shadow-[0_30px_60px_-30px_rgb(30_31_36/0.35)]">
      <div className="flex items-center gap-3 border-b border-[var(--mk-rule)] bg-[var(--mk-wash)] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#e3e3e6]" />
          <span className="size-2.5 rounded-full bg-[#e3e3e6]" />
          <span className="size-2.5 rounded-full bg-[#e3e3e6]" />
        </span>
        <span className="truncate rounded-md bg-white px-3 py-1 text-xs text-[var(--mk-pencil)]">{url}</span>
      </div>
      <Image src={src} alt={alt} width={1600} height={1000} unoptimized priority={priority} className="h-auto w-full" />
    </figure>
  );
}

const btnGreen =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--mk-green)] px-6 text-[15px] font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mk-green)]";
const btnLine =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--mk-graphite)]/20 px-6 text-[15px] font-semibold transition-colors hover:border-[var(--mk-graphite)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mk-graphite)]";

const productJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://gym.avnix.in/#org",
      name: "AvniX",
      url: "https://gym.avnix.in",
      logo: "https://gym.avnix.in/icon-512.png",
      address: { "@type": "PostalAddress", addressLocality: "Visakhapatnam", addressRegion: "Andhra Pradesh", addressCountry: "IN" },
    },
    {
      "@type": "SoftwareApplication",
      name: "AvniX GymOS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS",
      url: "https://gym.avnix.in",
      publisher: { "@id": "https://gym.avnix.in/#org" },
      description:
        "Gym management software for Indian gyms: members, QR check-in, GST billing, WhatsApp renewal reminders in Telugu and English, and a website for every gym.",
      areaServed: "IN",
      inLanguage: ["en", "te"],
    },
  ],
});

export function Landing() {
  return (
    <div className={`${caveat.variable} mk min-h-dvh overflow-x-clip antialiased`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />

      <header className="sticky top-0 z-40 border-b border-transparent bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
        <nav aria-label="Main" className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="AvniX GymOS home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--mk-green)]">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 text-[15px] text-[var(--mk-pencil)] md:flex">
            <a href="#day" className="hover:text-[var(--mk-graphite)]">
              How it works
            </a>
            <a href="#websites" className="hover:text-[var(--mk-graphite)]">
              Gym websites
            </a>
            <a href="#pricing" className="hover:text-[var(--mk-graphite)]">
              Pricing
            </a>
            <a href="#questions" className="hover:text-[var(--mk-graphite)]">
              Questions
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2.5 text-[15px] font-medium whitespace-nowrap hover:bg-[var(--mk-wash)]">
              Sign in
            </Link>
            <span className="hidden sm:contents">
              <a href={DEMO_MAIL} className={`${btnGreen} min-h-10 px-5 text-sm whitespace-nowrap`}>
                Book a demo
              </a>
            </span>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="px-4 pt-14 pb-20 sm:px-6 lg:px-8 lg:pt-20 lg:pb-28">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-6">
            <div>
              <h1 className="mk-display max-w-[9ch] text-[clamp(3.4rem,8.2vw,7rem)]">Put the register down.</h1>
              <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-[var(--mk-pencil)] sm:text-xl">
                GymOS runs your front desk, chases renewals on WhatsApp and puts your gym online. Made in Visakhapatnam for gyms across Andhra Pradesh.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href={DEMO_MAIL} className={btnGreen}>
                  Book a demo
                </a>
                <a href={DEMO_SITE} target="_blank" rel="noopener" className={btnLine}>
                  See a gym website <ArrowUpRight className="size-4" />
                </a>
              </div>
              <p className="mt-6 text-sm text-[var(--mk-pencil)]">Works on any phone or laptop. Telugu and English. GST-ready.</p>
            </div>
            <div className="relative">
              <Image
                src="/brand/doodles/register-to-phone.webp"
                alt="A paper attendance register with an arrow to a phone showing WhatsApp messages"
                width={1200}
                height={800}
                priority
                unoptimized
                className="mk-doodle h-auto w-full"
              />
              <p className="mk-hand absolute top-[4%] right-[4%] max-w-[12ch] rotate-[4deg] text-right text-[clamp(1.4rem,2.4vw,2rem)] font-bold">
                your notebook, retired
              </p>
            </div>
          </div>
        </section>

        {/* A day at the desk */}
        <section id="day" className="scroll-mt-20 border-t border-[var(--mk-rule)] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <h2 className="mk-display max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)]">A day at your front desk, with GymOS</h2>
            <ol className="mt-16 grid gap-20 lg:gap-24">
              {DAY.map((step, i) => (
                <li key={step.time} className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
                  <div className={i % 2 ? "md:order-2" : ""}>
                    <p className="mk-display text-[clamp(2rem,3.4vw,2.8rem)] text-[var(--mk-ink)]">{step.time}</p>
                    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-[var(--mk-pencil)]">{step.body}</p>
                  </div>
                  <div className="relative">
                    <Image src={`/brand/doodles/${step.doodle}.webp`} alt="" width={1200} height={800} unoptimized className="mk-doodle h-auto w-full" />
                    <p className={`mk-hand absolute -bottom-2 text-2xl font-bold ${i % 2 ? "left-2 -rotate-3" : "right-2 rotate-2"}`}>{step.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Product */}
        <section className="bg-[var(--mk-wash)] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <h2 className="mk-display max-w-[14ch] text-[clamp(2.4rem,5vw,4.2rem)]">Everything the desk knows, on one screen</h2>
              <p className="max-w-[36ch] text-[var(--mk-pencil)]">Your colours, your logo. This is a real gym on GymOS, with demo data.</p>
            </div>
            <div className="relative mt-14">
              <BrowserFrame
                src="/brand/product/dashboard.webp"
                alt="GymOS dashboard showing members, collections, dues, revenue and today’s check-ins"
                url="gym.avnix.in/dashboard"
              />
              <div className="pointer-events-none absolute top-[14%] -left-4 hidden -translate-x-full min-[1560px]:block">
                <p className="mk-hand w-[10ch] -rotate-6 text-right text-2xl font-bold">money in this month</p>
                <Arrow className="ml-auto h-10 w-28 text-[var(--mk-ink)]" />
              </div>
              <div className="pointer-events-none absolute top-[36%] -right-4 hidden translate-x-full min-[1560px]:block">
                <Arrow className="h-10 w-28 -scale-x-100 text-[var(--mk-ink)]" />
                <p className="mk-hand w-[10ch] rotate-3 text-2xl font-bold">who walked in, live</p>
              </div>
            </div>
            <ul className="mt-20 grid gap-x-16 md:grid-cols-2">
              {FEATURES.map(([title, body]) => (
                <li key={title} className="border-t border-[var(--mk-rule)] py-6">
                  <h3 className="text-lg font-semibold tracking-[-0.01em]">{title}</h3>
                  <p className="mt-1.5 max-w-[48ch] leading-relaxed text-[var(--mk-pencil)]">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Websites */}
        <section id="websites" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="mk-display max-w-[12ch] text-[clamp(2.4rem,5vw,4.2rem)]">Every gym gets a website</h2>
              <p className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-[var(--mk-pencil)]">
                Most gyms in Vizag have no website at all. Yours goes live at{" "}
                <span className="font-medium text-[var(--mk-graphite)]">yourgym.gym.avnix.in</span> — or your own domain — with your plans, coaches, photos and
                timings. Trial bookings land straight in your leads.
              </p>
              <ul className="mt-8 grid gap-3 text-[16px]">
                {[
                  "Show or hide prices with one switch",
                  "Free-trial booking that you can turn off",
                  "Built for Google search and WhatsApp sharing",
                  "Secure https on every site, automatically",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-[var(--mk-green)]" aria-hidden>
                      <path d="M3 10.5 8 15 17 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <a href={DEMO_SITE} target="_blank" rel="noopener" className={`${btnLine} mt-9`}>
                Visit Iron Paradise’s site <ArrowUpRight className="size-4" />
              </a>
            </div>
            <div className="relative">
              <BrowserFrame
                src="/brand/product/gym-site.webp"
                alt="A gym website built with GymOS, with a photo of a deadlift and a free trial button"
                url="ironparadise.gym.avnix.in"
              />
              <p className="mk-hand absolute -bottom-10 left-6 -rotate-2 text-2xl font-bold">made in an afternoon</p>
            </div>
          </div>
        </section>

        {/* Owner */}
        <section className="border-t border-[var(--mk-rule)] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
            <div className="relative mx-auto w-full max-w-[420px]">
              <Image src="/brand/doodles/owner.webp" alt="" width={960} height={1200} unoptimized className="mk-doodle h-auto w-full" />
            </div>
            <div>
              <h2 className="mk-display max-w-[15ch] text-[clamp(2.4rem,5vw,4.2rem)]">The questions you ask every evening, answered</h2>
              <dl className="mt-10 grid gap-7">
                {[
                  ["Who hasn’t paid yet?", "Dues, with one tap to send a reminder."],
                  ["Whose plan ends this week?", "A list, already messaged on WhatsApp."],
                  ["Did that trial person join?", "Every enquiry tracked from first message to membership."],
                  ["Are we actually making money?", "Collections minus expenses, month by month."],
                ].map(([q, a]) => (
                  <div key={q} className="grid gap-1 sm:grid-cols-[minmax(0,15ch)_1fr] sm:gap-8">
                    <dt className="mk-hand text-[1.75rem] font-bold">{q}</dt>
                    <dd className="text-[17px] leading-relaxed text-[var(--mk-pencil)] sm:pt-1.5">{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 bg-[var(--mk-graphite)] px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <h2 className="mk-display max-w-[13ch] text-[clamp(2.4rem,5vw,4.2rem)]">One setup fee. One monthly fee. That’s it.</h2>
              <p className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-white/70">
                No charge per member, no charge per check-in. The price depends on the size of your gym and how many branches you run — tell us about yours and
                we’ll send a quote the same day.
              </p>
              <a href={DEMO_MAIL} className={`${btnGreen} mt-9`}>
                Get a quote
              </a>
            </div>
            <div>
              <p className="text-lg font-semibold">Every plan includes</p>
              <ul className="mt-5 border-b border-white/12">
                {[
                  "Setup done for you, including importing your members",
                  "Your gym website with free https",
                  "WhatsApp, SMS and email automations",
                  "GST invoices and Excel exports",
                  "Staff accounts with roles",
                  "Support on WhatsApp from people in Vizag",
                ].map((item) => (
                  <li key={item} className="border-t border-white/12 py-4 text-white/85">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <h2 className="mk-display text-[clamp(2.4rem,5vw,4.2rem)] lg:sticky lg:top-28 lg:self-start">Questions owners ask us</h2>
            <div className="border-b border-[var(--mk-rule)]">
              {QUESTIONS.map(([q, a]) => (
                <details key={q} className="group border-t border-[var(--mk-rule)]">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden
                      className="relative size-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-current after:transition-transform group-open:after:scale-y-0"
                    />
                  </summary>
                  <p className="max-w-[60ch] pb-6 leading-relaxed text-[var(--mk-pencil)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-[var(--mk-rule)] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="mk-display max-w-[14ch] text-[clamp(2.6rem,5.6vw,4.8rem)]">See GymOS with your own gym’s numbers</h2>
              <p className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-[var(--mk-pencil)]">
                A 30-minute call. We’ll set up a trial workspace with your plans and a few of your members so you can see it working.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href={DEMO_MAIL} className={btnGreen}>
                  Book a demo
                </a>
                <Link href="/login" className={btnLine}>
                  Sign in
                </Link>
              </div>
            </div>
            <Image src="/brand/doodles/team.webp" alt="" width={1200} height={800} unoptimized className="mk-doodle h-auto w-full" />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--mk-rule)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 text-sm text-[var(--mk-pencil)] sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href={`mailto:${SALES_EMAIL}`} className="hover:text-[var(--mk-graphite)]">
              {SALES_EMAIL}
            </a>
            <span>© {new Date().getFullYear()} AvniX, Visakhapatnam</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
