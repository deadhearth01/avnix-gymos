# Build Plan — MVP v0.1 (core features)

**Date:** 28 Sep 2026
**App location:** `dev/`
**Stack:**
- Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui (Radix)
- `motion` for animation, Recharts for charts
- `web-haptics` for touch feedback
- Appwrite 2.0 (TablesDB) as the backend, accessed from the server through `node-appwrite`

## Design direction
We follow the BoardUI dashboard look:
- a floating white sidebar card;
- a green active nav pill with a count badge;
- KPI cards with tinted change badges (lime for up, red for down);
- lime bar and area charts, and purple activity heatmaps;
- data tables with status pills and dropdown status chips;
- segmented Weekly / Monthly / Yearly tabs;
- a light / dark toggle at the bottom of the sidebar, with the team card below it;
- ⌘K quick search.

Motion rules:
- Every icon animates on hover: a bounce, wiggle, spin, lift or ring chosen per icon.
- Page, card and list entrances are staggered.
- Nav active-state changes use a shared layout animation.

Feedback rules:
- Every tap or click gives feedback. On touch devices this is web-haptics vibration; on desktop it is a short click sound.
- Users can turn feedback off in Settings.

## Architecture
- **Backend-for-frontend.** The browser never talks to Appwrite directly. Server Components and Server Actions call Appwrite with the API key, and every query is scoped to the signed-in user's `gymId` through one data layer: `src/lib/data/*`.
- **Auth.** Appwrite email/password accounts. The session secret is stored in the httpOnly cookie `a_session_<projectId>`, and `proxy.ts` makes an optimistic redirect check on each request.
- **Demo mode.** If `APPWRITE_API_KEY` is empty and `DEMO_MODE=true`, an in-memory store takes over. It understands the Appwrite Query JSON and is pre-seeded with a demo gym, so the UI can be reviewed without a backend.

## Appwrite schema (database `gymos`)
All tables have `rowSecurity=false` and no client permissions, so only the API key can read or write them. Tenant isolation comes from the `gymId` column on every table.

| Table | Purpose | Key columns |
|---|---|---|
| gyms | Tenant | name, city, phone, gstin, address, stateCode, gstRate (5), gstInclusive, ownerId, whatsappNumber, settings(json) |
| staff | Users ↔ gyms, with roles | gymId, userId, name, email, role (owner / manager / frontdesk / trainer) |
| members | Member profile plus a denormalized current plan | gymId, code, name, phone, email, gender, dob, language (en / te / hi), goal, status (active / expiring / expired / frozen / cancelled), planName, startAt, expiresAt, balanceDue, lastVisitAt, visitCount, trainerName, notes |
| plans | Plans sold | gymId, name, type (duration / sessions / pt), durationDays, sessions, price, joiningFee, active, color |
| memberships | Each plan purchase | gymId, memberId, planId, planName, startAt, endAt, price, discount, status, freezeFrom, freezeUntil, freezeDays |
| invoices | GST invoices | gymId, memberId, number, issuedAt, subtotal, discount, taxable, taxRate, cgst, sgst, total, paid, balance, status, items(json) |
| payments | Money received | gymId, memberId, invoiceId, amount, method (cash / upi / card / bank), reference, paidAt |
| checkins | Attendance | gymId, memberId, memberName, at, dayKey, method |
| leads | Enquiry pipeline | gymId, name, phone, source, goal, status (new / contacted / trial_booked / trial_done / joined / lost), trialAt, followUpAt, notes |
| expenses | P&L inputs | gymId, category, amount, spentAt, note |
| automations | Playbook on/off switches and settings | gymId, key, enabled, config(json) |
| messages | Journey outbox and log | gymId, memberId, memberName, phone, playbook, body, status (pending / sent / skipped), dueAt, sentAt |
| counters | Invoice and member numbering | gymId, key, value |

## Core features in v0.1
1. **Auth and onboarding:** sign up, sign in, create gym (name, city, GSTIN, WhatsApp number). Starter plans are seeded automatically.
2. **Dashboard:**
   - KPI cards: active members, collections this month, dues outstanding, expiring in 7 days;
   - revenue bars (monthly);
   - check-ins trend (weekly, monthly or yearly);
   - attendance heatmap;
   - expiring-soon list;
   - at-risk members;
   - recent payments table.
3. **Members:**
   - a table with search, status filter, sort and pagination;
   - an Add-member sheet;
   - a member detail page (profile, membership timeline, invoices, payments, check-ins);
   - actions: renew / assign plan, record payment, freeze or unfreeze, check-in, WhatsApp.
4. **Plans:** create, edit and archive plans (duration, session or PT packs).
5. **Billing:**
   - GST invoice at 5% without ITC, split into CGST and SGST, SAC 999723;
   - partial payments and dues;
   - a printable invoice page;
   - a payments ledger.
6. **Front desk / attendance:**
   - search or scan to check a member in;
   - a status light: green (active), amber (expiring or dues), red (expired);
   - today's check-ins.
7. **Leads:** a pipeline board with status changes, trial date, follow-up date, and converting a lead into a member.
8. **Automations (Journeys):**
   - 8 playbooks: welcome, renewal ladder, expiry-day notice, dues chase, inactivity nudge, birthday wish, win-back, trial reminder;
   - each has a toggle and templates in English and Telugu;
   - a journey runner that queues messages in an outbox;
   - staff send each message with one tap on WhatsApp through a `wa.me` link (a WhatsApp Cloud API connection comes in v0.2);
   - a sent/skipped log.
9. **Finance:** income vs expenses, expense entry, and a monthly P&L summary.
10. **Settings:** gym profile, GST settings, feedback sounds and haptics, theme.
11. **Global UI:** ⌘K command palette, mobile slide-in drawer, dark mode, toasts.

## Deferred to v0.2+
- WhatsApp Cloud API sending and inbox
- UPI AutoPay mandates (Razorpay)
- AI receptionist, churn ML, voice, AI import
- Biometric devices
- Member PWA
- Microsite
- Multi-branch
- Staff invites UI
