# Gym Software — Market Research & Product Plan

**Date:** 28 Sep 2026 · **Launch market:** Visakhapatnam (Vizag), Andhra Pradesh; then the rest of AP and Telangana
**Status:** Research and planning only. No build decisions are final.
**Companion files:**
- [02-competitor-teardown.md](02-competitor-teardown.md): per-vendor table and complaint mining (Codex agent).
- [03-ai-rails-regulation-retention.md](03-ai-rails-regulation-retention.md): global AI benchmarks, WhatsApp/UPI/GST/DPDP/DLT rules, and retention science (OpenCode agent; secondary source).

**Method:** Web research by Claude (TinyFish search and fetch), a competitor teardown by a Codex agent, and a vendor-document review. The vendor comparisons are based on public documentation, not hands-on trials. The owner complaints come from a small sample of public reviews. Anything marked **[VALIDATE]** needs to be checked in person with Vizag gym owners before we build.

---

## 0. Executive summary

1. **The Indian gym-software market is crowded but still weak.** More than 20 Indian vendors all claim the same five features: WhatsApp reminders, UPI, GST invoices, biometric attendance and a member app. Prices run from ₹499/year to ₹3,000/month. These features are now the minimum any product must have, and none of them sets a vendor apart.
2. **The real gaps are in how these features actually work, not in whether they are listed.** Few vendors can prove they offer:
   - true **UPI AutoPay**, meaning a recurring mandate plus handling of retries and failed debits;
   - the **official** WhatsApp API rather than an unofficial WhatsApp Web workaround that can get the gym's number banned;
   - **reconciliation** that matches every UPI, cash or bank credit to the right member;
   - a **Telugu** interface;
   - retention tools that tell staff what to do next instead of just labelling members "at risk";
   - painless **migration** from registers and Excel;
   - a modern, clean UI.
3. **Vizag is mostly independent, low-tech gyms.** Google Maps lists about 367 gyms (Justdial lists 708). About **97% are single-owner**, and about **87% have no website**. Typical fees are around ₹1,500/month or ₹15,000–₹25,000/year. No vendor clearly dominates the city. Several national vendors run Vizag SEO pages, but I found no evidence of a strong local player. **[VALIDATE]** which tools gyms actually use (likely registers, Excel or cheap Android apps).
4. **Positioning:** *"The gym software that collects your fees and keeps your members — in Telugu, on WhatsApp, with no app for members to install."* We sell a result (revenue recovered and members retained) and show it inside the product. We do not sell a feature list.
5. **The AI should take actions, not just chat.** Priorities, in order:
   1. a WhatsApp AI receptionist in Telugu, Tenglish and English that books trials and sends payment links;
   2. explainable churn-risk scoring that creates staff tasks;
   3. a daily owner briefing on WhatsApp, plus "ask your gym anything";
   4. AI import from a photo of a paper register or an Excel file;
   5. Telugu voice commands at the front desk;
   6. AI drafts of workout and diet plans using Andhra and Indian foods, approved by a trainer.
6. **Go-to-market:** field sales in Vizag, onboarding done for the owner within 48 hours, and a 30-day "we recover more than we cost" promise. Pricing is flat per branch, never per member.

---

## 1. Market context

### 1.1 India
- India has about **46,500 fitness facilities**, projected to reach about 65,500 by 2030. There are about **13.6M paid memberships**, a penetration of about 0.12%. *(Ken Research via Torzil)*
- Other estimates put the total at **1.5–2 lakh gyms**, counting informal ones. Most gyms with fewer than 300 members still run on **Excel, WhatsApp groups and paper registers**. *(MyGymDesk)*
- Retention benchmarks:
  - The global average annual retention is **66.4%** (HFA 2025, 17,000+ facilities).
  - About **half of new members quit before 6 months**.
  - Members who attend **fewer than 4 times in their first month have about an 80% chance of cancelling**.
  - Traditional gyms retain 50–60%; boutiques about 75%; PT studios up to 80%.
- Lead response benchmarks from the US (Keepme, 45 brands, 1.6M conversations):
  - **57%** of enquiries get no reply at all.
  - Instagram replies average **37 hours**.
  - **52%** of gym searches happen after hours.
  - **82%** of prospects expect a reply within 10 minutes.
  - Only **3–6 of every 100 paid leads** become members.

  No equivalent Indian study exists, but the same problem is very likely here, because WhatsApp and Instagram DMs are the main enquiry channels.

### 1.2 Visakhapatnam specifically
| Data point | Value | Source |
|---|---|---|
| Gyms listed (Google Maps, Apr 2026) | 367, up 4.2% vs 2023 | Rentech/SmartScraper |
| Gyms listed (Justdial) | 708 (broader categories) | Justdial |
| Single-owner share | **97.3%** (357 of 367); only 10 belong to brands | Rentech |
| Gyms with no website | **87%** (320 of 367) | Rentech |
| Instagram presence (per that dataset) | only 13 handles found, so the digital footprint is tiny | Rentech |
| Average gym age | 4 years 5 months | Rentech |
| Typical fees | ~₹1,500/month; annual offers ₹15,000–₹17,999; premium ₹25,000/year (Varun Fitness) | Reddit r/Visakhapatnam, Instagram, varunfitness.com |
| Chains and brands present | Cult.fit (Siripuram and others), Anytime Fitness (Asilmetta), WTF gyms selling franchises, FITPASS aggregator | cult.fit, stanzaliving, wtfgymsfranchise, fitpass |
| Known local independents | Varun Fitness, Club F7, Tone Fitness, Fit n Feet, Traxx (Madhurawada), Infinity (Hanumanthavaka), Core Fitness (Rushikonda), Muscle Planet, Body Line, Ultimate Fitness Studio | various |
| Software vendors marketing to Vizag | GymForce, GymSmart, Kore App and MyGroce all run Vizag SEO pages; Justdial lists local "gym software distributors" at ₹2,000–15,000/month | vendor pages, Justdial |

**What this means for us:**
- The market is about **350+ independent gyms in Vizag alone** and several thousand across AP.
- These owners are phone-first and WhatsApp-native, but have almost no digital marketing presence. That is a gap no pure gym-management tool is filling.
- Other local conditions to design for: Telugu-speaking staff, power cuts (so the product must keep working offline), and biometric devices put in by local installers (usually eSSL or ZKTeco).
- GST state code **37** (AP).

**[VALIDATE] in field interviews (15–20 owners):**
- What they use today.
- What they pay for it.
- How many members they have.
- How they collect fees (cash, QR or link).
- Their biggest time sinks.
- Whether they would pay ₹1,500–₹3,000/month.

---

## 2. Competitive landscape

### 2.1 Tiers
| Tier | Vendors | Why gyms choose them | Why they fall short in AP |
|---|---|---|---|
| **International** | Mindbody, ABC Glofox, Zen Planner, Wodify, PushPress, Gymdesk, Exercise.com, Zenoti, Wellyx | Mature products, strong class booking, branded apps, Mindbody's consumer marketplace, advanced AI (Zenoti's AI Workforce, Mindbody's AI Concierge) | Priced in USD (₹7,000–₹29,000/month); no native UPI AutoPay, GST or WhatsApp; support in US time zones; built for card billing and class packs, not Indian monthly plans |
| **Established Indian** | FitnessForce, Traqade (Gympik/RoundGlass, **not** Cult.fit), Gymowl, Easy Gym Software, YDL | India-based support, INR pricing, GST, trusted by chains | Dated UX, heavy configuration, quote-led pricing, thin automation (mostly SMS and email) |
| **New India-first SaaS (2024–26)** | GymForce, Torzil, MyGymDesk (Hyderabad), Okfit, Kondria, AdviceFit, GymSmart, Kore App, SaathiX AI, GymKloud | Flat INR pricing, pitched on WhatsApp + UPI + GST, fast setup, AI "beta" features | Claims are hard to verify; key features sit behind higher tiers; WhatsApp is often the Web workaround on lower tiers; AutoPay is rarely real; no Telugu |
| **Cheap mobile apps** | GymBook (₹2,199–₹2,599/year), GoGym4U (₹2,499/year), Aapka Gym Manager (₹499/year), GYM Manager (W3ctrl) | Almost free, runs on the owner's phone, very simple | No real automation or AutoPay, weak on security (Aapka's Play listing says data is **not encrypted**), no member experience, missing PT and trainer fields |
| **Local desktop / reseller software** | Unnamed distributors on Justdial, bundled by biometric installers | Personal relationship, installer bundles it with the fingerprint device, one-time licence | Local-only data, no cloud sync, no WhatsApp, upfront licence plus AMC fees, poor support **[VALIDATE]** |

### 2.2 Key vendor facts (Sep 2026)
| Vendor | Price | WhatsApp | UPI AutoPay | Notable |
|---|---|---|---|---|
| Torzil | ₹1,500/month or ₹14,999/year | Official Cloud API | **Yes (claimed)** | Supports class packs, P&L and a native app; the only vendor clearly claiming AutoPay |
| GymForce | ₹9,999–₹14,999/year | Official API only on Pro | Not established | "AI churn" is labelled beta |
| MyGymDesk | ₹999–₹2,999/month + GST; Enterprise ₹44,999/year | Shared number; own-number API only on Enterprise | **No** (states this openly) | WhatsApp AI enquiry agent, AI plan drafts with quotas |
| Okfit | ₹500–₹3,000/month | Official API via MSG91 (+₹500/month + Meta fees) or the Web workaround | No (its "auto-renew" is not a UPI mandate) | Tiered; WhatsApp and member app start at Basic |
| Easy Gym Software | "from ₹799" | Official API claimed | Not established | **Member experience runs through WhatsApp**; "Easy AI" in Hindi and other languages, **no Telugu** |
| GymSmart | ₹9,999–₹39,999/year | **Web workaround** on Advance; official API only on Enterprise | Payment links only | Turnstiles, payroll, chatbot in Hindi and Gujarati |
| AdviceFit | Free up to 25 members; ₹8,000–₹15,000/year | Advertised | Not established | "AI health platform" aimed at coaching |
| SaathiX AI | not public | Yes | ? | **Voice commands in 28 languages, Telugu included**; launched Jun 2026, tested in 44 gyms. **Watch this one closely.** |
| Zenoti (global) | quote | — | — | The benchmark for AI: AI Receptionist (29 languages), Lead Manager (replies within 90 seconds), churn ML (flags 14+ days early), Business Advisor, Workout Builder |

The full per-vendor table is in [02-competitor-teardown.md](02-competitor-teardown.md).

### 2.3 Why the popular platforms get chosen
1. **Price.** Owners compare the monthly headline price; the three-year total cost is rarely checked.
2. **A local person.** A reseller or biometric installer who visits and sets it up.
3. **WhatsApp reminders.** The single most-asked-for feature.
4. **Word of mouth** from other gym owners, plus trainer networks.
5. **Brand pull.** Chains stay with FitnessForce, Traqade or Mindbody for multi-branch control.
6. **Fast setup.** Anything that promises "live in 1 day" wins trials.

### 2.4 What owners complain about (public reviews + Codex sample)
| Theme | Examples |
|---|---|
| Total cost is unclear | Add-ons, message credits, payment-gateway fees, per-member pricing, feature tiers |
| Poor support and a steep learning curve | "Emails don't even get returned" (Mindbody); settings "tricky to find" (Wellyx) |
| Bugs and unreliability | PushPress threads describe daily glitches and fixes taking many days |
| PT and trainer workflows are weak | No trainer field for PT sessions (GymBook); staff apps lacking |
| Members juggle too many apps | Separate apps for booking, scores and door access |
| Payment-gateway friction in India | "local payment gateways need zapier sometimes" |
| Software is overloaded | "most gym software feels overloaded and complicated" |
| Why owners resist switching | "It's working fine"; fear of migrating data; cost anxiety; front-desk staff resisting; too many features; habit of running everything on WhatsApp; putting it off |

---

## 3. The gaps we will target (ranked)

| # | Gap | Why it hurts | Our answer |
|---|---|---|---|
| 1 | **Fee collection leaks.** Mixed cash, static QR, links and bank transfers go unreconciled | Dues are forgotten, staff skim, the owner can't trust the numbers | Unified ledger, auto-matching of UPI and bank credits, an exceptions queue, a cash-drawer close with variance, an audit trail |
| 2 | **No real UPI AutoPay** | Every renewal becomes a chase | A Razorpay or Cashfree UPI AutoPay mandate at joining, a pre-debit notice, a smart retry ladder, a fallback payment link, gate access tied to payment status |
| 3 | **Automation is only "a reminder 3 days before expiry"** | Nothing covers onboarding, lapsed members, birthdays, win-backs or leads | A **Journey engine** with 25+ ready-made playbooks (see §5) |
| 4 | **WhatsApp done badly** | The Web workaround gets numbers banned; shared sender numbers look like spam; no two-way inbox; hidden costs | Official Cloud API on **every** tier, the gym's own number with its own name, a two-way team inbox, message costs passed through transparently, cost-optimised routing (see §5.3) |
| 5 | **No Telugu** | Front-desk staff and many members are more comfortable in Telugu | Telugu UI, Telugu/English/Hindi message templates, Telugu and Tenglish AI and voice |
| 6 | **"At risk" labels with no action** | The owner sees a red badge and does nothing | Churn score **with a reason** (for example "no visit in 9 days, was 4×/week"), an assigned task, a one-tap AI-drafted message, and a tracked outcome |
| 7 | **Migration fear** | Owners stay on registers | AI import from photos of the register, Excel or other apps; **we do the migration within 48 hours** |
| 8 | **Ugly, dense UI** | Staff resist, owners give up | A consumer-grade design system, mobile-first, 3 taps for the common actions, a check-in and renewal "Front Desk mode" |
| 9 | **No marketing or lead gen** (87% of gyms have no website) | Growth depends on walk-ins | An auto-generated gym microsite, trial booking, an Instagram/WhatsApp click-to-chat lead inbox, a Google-review engine, referrals |
| 10 | **Owner can't see profit** | Only collections are shown, not rent, salaries or commissions | An expenses module, PT commission, a simple P&L, a cash-flow forecast |
| 11 | **PT revenue is untracked** | PT is the highest-margin line and is invisible | PT packs, session consumption, trainer commission, and PT upsell prompts from attendance data |
| 12 | **Hidden pricing** | Owners lose trust | Flat per-branch pricing, unlimited members, public price page, no setup fee |
| 13 | **Access control fails in both directions** | Expired members get in, or paid members are locked out when the network drops | Direct eSSL/ZKTeco integration, offline-tolerant gate rules, instant unlock on payment |
| 14 | **Loose staff controls** | Discounts, deleted entries and back-dated edits by staff | Role permissions, discounts that need owner approval via WhatsApp, an immutable audit log |
| 15 | **DPDP Act compliance** (full compliance required by **13 May 2027**) | No vendor talks about it; biometric data is sensitive | Consent records, a data-principal rights portal, retention policies, India-hosted data. We sell this as "DPDP-ready" |

---

## 4. Product: modules & features

Personas:
- **Owner**, usually on mobile.
- **Manager / front desk**, on a tablet or desktop.
- **Trainer**, on mobile.
- **Member**, on WhatsApp plus a no-install PWA.
- **Lead / prospect**.

### 4.1 Core (MVP — minimum features to compete)
- **Members:** profile, photo, emergency contact, goals, health notes (with consent), tags, family and couple plans, bulk import.
- **Plans:** plans by duration, session packs, drop-ins, PT packs, add-ons (locker, towel); joining fee; offers and coupons; pro-rata charging.
- **Membership lifecycle:** join, renew, upgrade or downgrade, **freeze or pause** (expiry extended automatically), transfer, cancel with a recorded reason.
- **Billing:** GST invoices. Gym, PT and yoga services have been charged at **5% GST without input tax credit since 22 Sep 2025** (they were 18% before). Invoices use SAC 999723, CGST/SGST for in-state and IGST for other states, and AP state code 37. Gyms can't claim input GST on rent or equipment, so the P&L must count it as a cost. Several competitors' marketing still says 18%. Also: partial payments, dues, refunds and credit notes, receipts sent on WhatsApp.
- **Payments:** Razorpay or Cashfree UPI AutoPay mandates, payment links, dynamic UPI QR at the counter, cash entry, **auto-reconciliation** of payments to members.
- **Attendance:** QR check-in (member shows a QR, or scans the gym QR with an automatic geo-check), eSSL/ZKTeco biometric and face devices, manual entry; unique visits and total check-ins counted separately.
- **Communication:** official WhatsApp Cloud API with a team inbox; SMS via a DLT-registered route; email.
- **Journeys (automation):** the ready-made playbooks listed in §5.
- **Dashboard:** today's collections, dues, expiring members, at-risk members, leads, attendance heatmap.
- **Staff and roles:** owner, manager, front desk and trainer, with permissions and an audit log.
- **Reports:** revenue, dues ageing, renewals, churn, PT, GST export (GSTR-1 ready), CSV export of everything.
- **Telugu + English UI** from the first release.

### 4.2 Differentiators (build in v1 or v2)
- **Lead CRM:** captures leads from the WhatsApp click-to-chat, Instagram DMs, the website form, walk-ins and the Justdial/Google call log. The pipeline runs Enquiry → Trial booked → Trial done → Joined / Lost (with a reason). Includes follow-up tasks.
- **Trial flow:** book a trial slot on WhatsApp, reminder, check-in, follow-up after the trial, and an offer that expires.
- **Gym microsite:** generated automatically from the gym's profile (photos, plans, timings, trainers, map, reviews), with online joining, a trial button and SEO pages in Telugu and English.
- **Google review engine:** after a positive NPS score or a milestone (for example the 10th visit), the member gets a review link; unhappy responses go privately to the owner.
- **Referral program:** a member-specific WhatsApp link that tracks referrals and rewards them with free days or credit.
- **Member PWA (no install needed):**
  - digital membership card and QR;
  - plan, dues and payment history;
  - pay or renew with UPI;
  - freeze request;
  - class and PT booking;
  - workout and diet plan;
  - progress (weight, measurements, photos);
  - attendance streaks and badges;
  - crowd meter ("how busy is the gym now");
  - refer a friend.
- **Trainer app:** my clients, today's PT sessions, marking a session as consumed, assigning workout and diet plans, progress check-ins, my commission, and a list of clients I haven't seen recently.
- **Expenses and P&L:** rent, salaries, electricity and supplement stock → monthly P&L per branch, and a forecast of collections due.
- **Inventory / POS:** supplements, shakers, merchandise, with a GST bill.
- **Multi-branch:** one member record across branches, branch-level P&L, and a visit to two branches on the same day counted once.
- **Offline mode:** the front desk keeps working during power or network cuts and syncs later.

### 4.3 Owner controls (build trust)
- Discount above X% → the owner gets an approve/deny request on WhatsApp.
- Deleting a record, back-dating an entry or giving a refund → requires a reason, is logged, and alerts the owner.
- End-of-day cash close → counted cash vs. system cash, with any variance sent to the owner.

---

## 5. Automation playbooks (the Journey engine)

This is where we stand out. Every playbook comes **pre-built, in Telugu and English, and can be switched on with one toggle**. Owners can edit the timing and wording. Every message has a delivery log. Unsubscribe and opt-out requests are honoured automatically.

### 5.1 Playbook library
| Stage | Playbook | Trigger → Actions | Channel / WA category |
|---|---|---|---|
| **Lead** | Instant reply | New enquiry → AI answers within 60 seconds and offers a trial slot | WA service message (free within the 24-hour window) |
| | Trial reminder | 1 day before and 2 hours before the trial → reminder with a map link | WA utility |
| | Missed trial | No-show → "Reschedule?" the same day, again on day 2, then a staff task | WA utility, then a task |
| | Post-trial offer | 2 hours after the trial → a personalised offer that expires in 48 hours | WA marketing |
| | Deferred lead | "Call me next month" → brought back automatically on that date | Task + WA |
| **Join** | Welcome | Payment → welcome message, invoice, gym rules, trainer introduction, link to the PWA card | WA utility |
| | AutoPay setup | At joining → mandate link; if skipped, reminded on days 3 and 7 | WA utility |
| **First 30 days** (the 4-visit rule) | Onboarding ladder | Days 1, 3, 7, 14, 21 and 30: check-ins, a tip, trainer contact, progress check | WA utility / marketing |
| | Early-slip alert | Fewer than 2 visits in the first 10 days → trainer task plus a friendly nudge | Task + WA |
| | First-month milestone | 4th and 12th visits → a celebration message with a streak badge | WA utility |
| **Engagement** | Inactivity ladder | Absent 5, 10, 15 or 21 days, relative to that member's normal pattern → a gradually stronger message, then a trainer call task | WA + task |
| | Birthday / anniversary | Birthday, or the member's joining anniversary → a wish plus a small offer | WA marketing |
| | Milestones | 50th or 100th visit, or a weight goal reached → celebration plus a review request | WA |
| | PT upsell | Visits often but has no PT, or stuck on a plateau → a free PT consult offer | WA marketing |
| | Class reminders | Booked class → reminder 2 hours before; waitlist promotion | WA utility / push |
| **Renewal** | Pre-expiry ladder | 15, 7, 3 and 1 day before expiry, the expiry day, and +3 days → renewal link with an early-bird offer | WA utility |
| | AutoPay pre-debit | 24 hours before the debit → notice (required by RBI) | WA utility / SMS |
| | Failed debit | Failed → retry after 1 and 3 days, then a payment link, then a staff task | WA utility |
| | Upgrade nudge | Monthly member for more than 3 months → offer a quarterly or annual plan with savings shown | WA marketing |
| **Dues** | Dues chase | Balance due → days 0, 3 and 7, then escalate to staff; gate access limited after X days (optional) | WA utility |
| **Leave / return** | Freeze return | Freeze ends → "Welcome back" message with a plan reminder | WA utility |
| | Exit survey | Cancelled or expired without renewal → a 1-tap reason survey | WA |
| | Win-back | 7, 30, 60 and 90 days after expiry → a gradually better comeback offer | WA marketing |
| | Seasonal | New Year, Sankranti, Dasara, Diwali, summer vacation (students), pre-wedding season → targeted campaigns | WA marketing |
| **Internal** | Owner brief | Daily at 8 PM on WhatsApp: collections, dues, expiring members, at-risk members, leads, anomalies | WA to the owner |
| | Staff tasks | Daily task list per staff member | App + WA |
| | Cash-close alert | Variance above ₹X → owner is alerted | WA |

### 5.2 Rules
- **Quiet hours:** no marketing messages between 9 PM and 8 AM.
- **Frequency cap:** at most N marketing messages per member per week.
- Every member has a **per-channel consent** flag.
- Messages go out in **the member's own language**.
- If WhatsApp fails, the message falls back to SMS, then email.
- Every journey has an **analytics view**: sent → delivered → read → replied → converted (renewed or paid), with ₹ attributed.

### 5.3 WhatsApp cost engineering (India, 2026)
- Meta's approximate rates in India:
  - Marketing: **₹0.86/message**.
  - Utility and authentication: **₹0.115–0.145/message**.
  - Service conversations started by the member: **free**.
  - Utility templates sent **inside an open 24-hour customer-service window are free** (per-message pricing since July 2025).
- **Design implications:**
  - Classify templates correctly: renewals, receipts and reminders are **utility**; offers are **marketing**.
  - Invite replies ("Reply 1 to confirm your slot") so a 24-hour window opens, which makes the follow-ups free.
  - Batch the owner briefings.
- Estimated monthly WhatsApp cost for a 400-member gym:
  - about 2,000 utility messages ≈ ₹250;
  - 2 marketing broadcasts ≈ ₹700;
  - total **about ₹1,000/month**.

  We pass this through at cost or with a small margin, shown on a live meter so there are no surprises.
- **Options:** become a Meta Tech Provider (cheapest at scale) or start through a BSP such as Gupshup, AiSensy, Interakt or MSG91.

---

## 6. The AI layer

**Principle:** the AI either **does work** or **tells someone what to do next, with the reason**.
- It never invents prices or policy. It answers only from that gym's configured data.
- Any action that moves money or changes a membership needs a human to confirm it.
- Everything the AI does is logged and can be undone.

### 6.1 Priority AI features
| P | Feature | What it does | Why it matters | Build notes |
|---|---|---|---|---|
| **P0** | **AI WhatsApp receptionist** (Telugu, Tenglish, Hindi, English) | Answers questions about fees, timings, trainers, parking and women's batches; books trials; sends plan and payment links; handles "is my membership active?"; hands off to staff with a summary | 57% of enquiries go unanswered and 52% arrive after hours; Zenoti reports 2–3× more bookings from instant response | Claude Haiku for replies and routing, Sonnet for harder cases; tool calls into our API (plans, slots, payment links); a gym knowledge base; hand-off to a human when unsure |
| **P0** | **Churn radar + next best action** | Scores each member daily from visit frequency compared with their own baseline, recency, dues, days to expiry, tenure, PT status and replies. Gives the **top reasons** in plain language, creates a task, and drafts the message | Retention is where the money is: under 4 visits in the first month means about 80% cancel | Start with **transparent rules plus a simple scoring model**, then train per gym (gradient boosting) once there is data; measure how many flagged members were saved |
| **P0** | **Owner daily brief + "Ask your gym"** | At 8 PM on WhatsApp: "₹42,300 collected, ₹18,500 overdue from 11 people, 6 at risk, 3 hot leads". The owner can ask questions like "Which trainer's clients renew the most?" | Owners live on WhatsApp and rarely open dashboards | Text-to-SQL over a read-only, tenant-scoped view with approved query templates; answers include a small chart |
| **P0** | **AI import** | Photo of the paper register, Excel file, or an export from another app → structured members, plans, expiries and dues, with a review screen for doubtful rows | Removes the biggest reason owners don't switch (fear of migration) | Claude vision for reading the photos; fuzzy de-duplication; a confidence score per field |
| **P1** | **Telugu voice at the front desk** | "Ravi ki 3 months renew cheyyi, 4500 cash" → a pre-filled renewal waiting for confirmation | Staff type slowly, and India is a voice-first market (SaathiX is already pitching this) | Speech-to-text (Indic STT, e.g. Sarvam or Google) → parsed into structured intent → confirmation screen |
| **P1** | **AI message writer** | Writes personalised nudges in Telugu or English in the gym's tone; staff approve or edit | Makes messages feel personal instead of templated | Guardrails: no medical claims, no fake discounts |
| **P1** | **AI workout & diet plans** | Trainer enters goal, level, equipment and diet preference (veg, non-veg, egg; Andhra meals, rice-heavy; budget) → a multi-week plan draft → trainer edits and assigns | Trainers save hours, members get value from the app | Always approved by a trainer; uses an exercise library with videos |
| **P1** | **Payment reconciliation AI** | Matches UPI and bank credits (from bank SMS or statements, or gateway webhooks) to members by amount, name, UPI ID and time; queues anything it can't match | Gap #1, and a trust builder | Rules first, AI for the fuzzy cases |
| **P2** | **Smart renewal offers** | Predicts who will renew anyway and who needs a push, so discounts go only where they change the outcome | Protects margin | Needs data from several gyms; A/B testing |
| **P2** | **Review-reply & reputation AI** | Drafts replies to Google reviews and summarises complaint themes | Local search visibility | Google Business Profile API |
| **P2** | **Crowd meter & best-time suggestions** | Forecasts how busy the gym will be from attendance; members see "quiet now" | Improves the member experience and spreads out peak hours | Time-series forecast |
| **P2** | **Trainer performance insights** | How well each trainer's clients stay, and PT conversion, per trainer | Helps owners coach staff | Analytics |
| **P3** | **AI outbound voice calls** for lapsed members (Telugu) | Friendly check-in calls | High reach, but TRAI rules and member tolerance are risks | Only with explicit consent; later phase |
| **P3** | **Progress-photo analysis / form check** | Summarises visual progress; camera-based form tips | Novel, but reliability is uncertain | Experimental; opt-in only |

### 6.2 AI to avoid (hype, or risky in the gym context)
- Generic chatbots that answer but cannot **take any action**.
- Auto-sending discounts or refunds without a human confirming.
- Medical, injury or supplement advice. The AI must deflect these to a trainer or doctor.
- Computer-vision form checks at the gym floor as a headline feature.
- AI voice *coaching*: only about 10% of consumers prefer an AI coach to a human one.
- Camera-based crowd counting. Our crowd meter uses check-in data only.
- **Evidence summary:**
  - AI receptionist and lead response: proven (60–74% of conversations handled automatically in the Replify cases; Keepme customers report +185% lead-to-sale).
  - Churn prediction: widely shipped, but few vendors publish the churn reduction it achieves.
  - AI workout plans: work well with a trainer reviewing them.
  - AI diet plans: good as drafts only.

  Details are in file 03, §A5.

### 6.3 Guardrails & compliance
- AI data stays within each gym's account; nothing crosses tenants.
- Personal data (PII) is kept to the minimum in prompts, and prompts and outputs are logged for audit.
- Consent is required before any AI conversation is used for training or insights.
- The member can always type "talk to human".
- Biometric templates never leave the device or the gym's own boundary.
- DPDP compliance: a consent notice in Telugu and English, and access and delete requests handled in-app.

---

## 7. End-to-end workflows

### 7.1 Lead → member
```
Instagram ad / Google Maps / walk-in / referral link
  → WhatsApp click-to-chat (the gym's own number)
  → AI receptionist: greets in Telugu or English, answers the question, offers trial slots
  → Trial booked → reminders at 24h and 2h (with map)
  → Trial check-in (QR) → trainer notified with the lead's goal
  → 2h later: personalised offer that expires in 48h + payment link (UPI AutoPay option)
  → Paid → member created automatically, invoice sent, welcome journey starts, biometric enrolment task
  → Not paid → nurture over days 2, 5 and 14 → "lost" with a reason → added to the monthly re-engagement list
```

### 7.2 Onboarding (first 30 days, aiming for 4+ visits)
```
Day 0  welcome + PWA card + gym rules + trainer introduction; UPI AutoPay mandate prompt
Day 1  "How was your first workout?" (reply opens a free 24h window) → workout plan assigned
Day 3  if 0 visits since joining → nudge; trainer task
Day 7  check-in; if fewer than 2 visits → "early-slip" task for the trainer to call
Day 14 progress check (weight/measurements) → celebrate
Day 21 streak badge / PT consult offer
Day 30 NPS survey → promoters get a Google review link and referral link; detractors → owner alert
```

### 7.3 Renewal & collection
```
AutoPay member:  T-24h pre-debit notice → debit → receipt + GST invoice on WhatsApp → done
                 failed → retry after 1 and 3 days → payment link → staff task → gate rule
Manual payer:    T-15/7/3/1/0 reminders with 1-tap UPI link → paid → invoice + "Thanks"
                 T+3 → staff call task → T+7 → gate restriction (optional) → win-back journey
Counter payment: staff taps "Renew" (or says it by voice) → UPI QR / cash → receipt on WhatsApp
Reconciliation:  gateway webhooks + bank feed → matched automatically → exceptions queue for the owner
```

### 7.4 At-risk → saved
```
Nightly churn job → member scored with reasons (e.g. "was 4×/week, 0 visits in 9 days, expiry in 12 days")
→ task for their trainer, with an AI-drafted Telugu/English message
→ trainer sends it (1 tap) or calls → outcome logged (came back / injury → freeze / moving away)
→ Weekly "Saved members: 7, ₹31,500 retained" card shown to the owner
```

### 7.5 Front desk day
```
Opening: offline sync check → today's list: expiring today, dues, PT sessions, trials due
Peak hours: Front Desk Mode — scan/biometric → green (active) / amber (dues or expiring) / red (expired)
            → amber/red shows a 1-tap "collect now" button
Walk-in enquiry: quick lead form (name, phone, goal) → AI takes over the follow-up
Closing: cash count → variance → sent to the owner
```

### 7.6 Owner's week
- **Daily 8 PM brief** on WhatsApp.
- **Monday "Growth card":**
  - new members vs lost members;
  - renewal rate;
  - lead conversion;
  - top 3 actions for the week.
- **Month-end pack:**
  - P&L;
  - GST export;
  - trainer commissions;
  - comparison with last month.
- **Anytime:** "Ask your gym" on WhatsApp.

### 7.7 Trainer day
- Today's PT sessions, marked as done on completion (which uses up a session).
- A list of "my members at risk".
- Plans to review (AI drafts).
- A commission tracker.

### 7.8 Member self-service (no app install)
All through WhatsApp or the PWA link:
- see plan and expiry;
- pay or renew;
- request a freeze;
- book a class or PT session;
- see the workout plan;
- log weight;
- refer a friend;
- raise a complaint.

---

## 8. UX & design direction
- **Mobile-first, dual mode.** A full-screen owner app on mobile, and a fast, keyboard-friendly desktop and tablet mode for the front desk.
- **The 3-tap rule** for the top actions: check-in, renew, collect dues, add a lead.
- **Colours carry status.** Active is green, expiring is amber, expired or due is red. The whole product uses the same colours.
- **Telugu typography.** Noto Sans Telugu with correct line heights; tested with real Telugu staff.
- **Empty states that teach.** For example: "No journeys on yet — switch on 'Renewal ladder' to recover ₹X/month (estimated from your data)."
- **"Money recovered" counter** on the home screen: renewals and dues recovered through automations. This is proof the product pays for itself.
- **Dark mode, fast loads** (under 2 seconds on 4G), and the app still works on cheap Android phones.
- Design references: Linear/Stripe dashboard clarity, and WhatsApp-native conversational patterns.

---

## 9. Suggested technical architecture (to confirm in the build phase)
| Layer | Choice | Why |
|---|---|---|
| Web app / PWA | Next.js (App Router) + Tailwind + shadcn/ui | Fast to build; SSR microsites for SEO; the member PWA runs on the same code |
| DB / auth | Postgres (Supabase, Mumbai region) with row-level security per gym | Keeps data in India (DPDP); built-in auth, storage and realtime |
| Jobs / journeys | A durable workflow/queue engine (e.g. Inngest, Trigger.dev, Vercel Workflow or pg-boss) + cron | Journeys are long-running, scheduled, retry-safe state machines |
| WhatsApp | Meta Cloud API directly (Tech Provider / embedded signup) or a BSP to start | Each gym uses its own number; lowest cost per message |
| SMS | DLT-registered provider (MSG91 / 2Factor) | TRAI rules |
| Email | Resend / Amazon SES | Receipts, reports |
| Payments | Razorpay Subscriptions (UPI AutoPay) + Cashfree as backup; Route/linked accounts so money settles to each gym | Mandates, retries, webhooks |
| Biometric | ZKTeco / eSSL via ADMS push (cloud) + a local bridge agent for offline | The most common devices in AP |
| AI | Claude (Haiku 4.5 for high-volume replies and classification, Sonnet 5 for the agent and analysis); Indic speech-to-text (Sarvam/Google) | Quality in Telugu and Tenglish; tool use |
| Analytics / ML | SQL feature store + a nightly scoring job (Python) | Churn scores |
| Mobile | PWA first; React Native / Expo wrapper later if app-store presence matters | Members don't have to install anything |

---

## 10. Pricing & go-to-market (Vizag first)

### 10.1 Pricing (hypothesis — **[VALIDATE]**)
| Plan | ₹/month (billed yearly) | For |
|---|---|---|
| Starter | ~₹999 | Up to 1 branch: core, billing, QR attendance, WhatsApp reminders, Telugu UI |
| **Growth** (hero) | ~₹1,999 | + Journeys library, UPI AutoPay, AI receptionist, churn radar, owner brief, microsite, review engine |
| Pro | ~₹3,499 | + biometric/gate, PT & commission, P&L, voice, multi-branch |

- Every plan: **unlimited members, no setup fee**, WhatsApp charged at cost with a visible meter, and free migration.
- Guarantee: *"If automations don't recover at least 2× your subscription in 60 days, the next 3 months are free."*

### 10.2 GTM
1. **Discovery (2 weeks).** Interview and visit 15–20 Vizag gyms across MVP Colony, Dwaraka Nagar, Seethammadhara, Gajuwaka, Madhurawada, Rushikonda and Pendurthi. Collect their current tools, pains, fee levels and willingness to pay.
2. **Design partners.** 5 gyms get free use for 3 months in return for weekly feedback and a case study.
3. **Field sales + done-for-you onboarding** in Telugu. We do the migration, set up biometric enrolment waves, and train the front desk.
4. **Partnerships:** biometric installers (eSSL/ZKTeco dealers), equipment dealers, supplement distributors and trainer certification academies. Offer a referral commission.
5. **Proof marketing.** A "₹ recovered" case study from each design partner; Telugu reels showing the WhatsApp AI receptionist.
6. **Expansion path:** Vijayawada, Guntur, Rajahmundry, Tirupati, Kakinada, then Hyderabad.

---

## 11. Roadmap
| Phase | Duration | Scope |
|---|---|---|
| **0 — Validate** | 2 weeks | Field interviews, design partners signed, clickable prototype (Figma) tested in Telugu |
| **1 — MVP** | ~10 weeks | Members/plans/billing/GST, UPI links + AutoPay, QR check-in, official WhatsApp + inbox, 10 core journeys (renewal, dues, welcome, onboarding, inactivity, win-back, birthday, trial, owner brief), dashboard, Telugu UI, AI import, member PWA card |
| **2 — Differentiate** | +8 weeks | AI receptionist, churn radar + tasks, lead CRM + microsite, review and referral engines, biometric integration, reconciliation, PT/trainer app, expenses/P&L |
| **3 — Scale** | +8 weeks | Voice (Telugu), AI plans, Ask-your-gym, multi-branch, offline mode, POS, smart offers, crowd meter, native app wrapper |

**North-star metric:** ₹ recovered per gym per month from automations.

**Other key metrics:**
- renewal rate;
- dues collection rate (share of dues collected within 7 days);
- lead → member conversion;
- time to first value (target: the first automated renewal collected within 7 days of signup);
- logo churn (gyms leaving us).

---

## 12. Risks
| Risk | Mitigation |
|---|---|
| Crowded market; vendors copy features | Win on execution, Telugu, local presence, outcome guarantee, and data built up per gym |
| Meta WhatsApp policy or price changes; template rejection | Templates classified correctly; opt-in; SMS/email fallback; cost meter |
| UPI AutoPay failures (mandates need a bank that supports them, members cancel) | Always keep a fallback payment link; handle mandates cancelled from the member's side |
| Biometric device variety | Certify 3–4 models; sell pre-configured devices through partners |
| Owners are price-sensitive | ROI counter, guarantee, yearly billing |
| AI hallucinating prices or policy | AI answers only from gym data; tool-based answers; human fallback |
| DPDP liability (biometrics, health data) | Consent flows, minimal data, data hosted in India, a data processing agreement with each gym |
| SaathiX and others racing on Telugu voice | Ship the Telugu WhatsApp AI early; go deep on local field presence |

---

## 13. Open questions for you
1. **Who we target first:** independent gyms with 100–800 members (recommended), or premium studios and chains?
2. **Product name and brand:** working name?
3. **WhatsApp route:** go straight to Meta Tech Provider, or launch on a BSP (faster) and migrate later?
4. **Hardware:** resell pre-configured biometric devices, or integrate only?
5. **Team and budget** for field sales in Vizag.
6. Is a **member-facing AI coach** in scope for v1? (I recommend no: stay trainer-in-the-loop.)

---

## Sources
- Torzil — Best gym management software in India 2026 (rubric, retention stats, market size): https://www.torzil.com/blog/best-gym-management-software-india
- MyGymDesk — 15 platforms compared (Sep 2026): https://mygymdesk.com/blog/best-gym-management-software-india-2026
- MyGymDesk — Why Indian gyms struggle to migrate from Excel: https://mygymdesk.com/blog/why-indian-gyms-struggle-excel-to-software-migration
- GymKloud — India buyer's guide 2026: https://gymkloud.in/blog/top-gym-management-software-india-2026
- GymForce — Vizag comparison page: https://gymforce.in/blog/best-gym-software-in-visakhapatnam/
- MyGroce — Vizag page: https://www.mygroce.in/gym-software-visakhapatnam
- Rentech/SmartScraper — Gyms in Visakhapatnam dataset: https://rentechdigital.com/smartscraper/business-report-details/india/andhra-pradesh/list-of-gyms-in-visakhapatnam
- Justdial — Gyms in Visakhapatnam: https://www.justdial.com/Visakhapatnam/Gyms/nct-11575244
- Stanza Living — Gyms in Vizag: https://www.stanzaliving.com/blog/gyms-in-vizag
- Varun Fitness pricing: http://www.varunfitness.com/
- Reddit r/Visakhapatnam — membership cost: https://www.reddit.com/r/Visakhapatnam/comments/1ka2q2w/how_much_gym_membership_will_cost/
- Reddit r/gymowner — Indian owners on software: https://www.reddit.com/r/gymowner/comments/1sd9nrv/indian_gym_owners_using_gym_software_kindly_help/
- Reddit r/crossfit — honest software discussion: https://www.reddit.com/r/crossfit/comments/1mbhfrf/honest_conversation_about_gym_management_software/
- SaathiX AI (voice, 28 languages): https://saathix.com/resources
- Keepme — US fitness lead conversion research: https://www.keepme.ai/case-studies/research-the-state-us-fitness-operator-lead-conversion
- Zenoti — AI for gyms: https://www.zenoti.com/ai-for-gyms-and-health-clubs
- WhatsApp pricing (Meta): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing · India rates: https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026 · https://aisensy.com/pricing
- RBI e-mandate framework 2026 (₹15,000 without extra authentication, 24h pre-debit notice): https://m.rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=13374
- DPDP Rules 2025 (notified 13–14 Nov 2025; full compliance by ~13 May 2027): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf
- Full list of competitor sources: [02-competitor-teardown.md](02-competitor-teardown.md)
