# GymOS — gym management for India, by AvniX

Multi-tenant SaaS: every gym gets its own dashboard, staff logins, a public website at `<slug>.gym.avnix.in` (or a custom domain), GST billing, WhatsApp/SMS automations in English and Telugu, and live front-desk check-ins. AvniX runs everything from a super-admin console.

**Stack**
- Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, Tailwind v4, shadcn/ui (Radix), `motion`, Recharts
- Appwrite 2.0: TablesDB, Auth, Teams, Realtime, Storage, Functions, Sites, Proxy rules
- Twilio: SMS, WhatsApp, Email
- `web-haptics` for touch feedback, synthesized UI sounds on desktop

---

## Quick start

```bash
npm install
npm run setup:appwrite      # idempotent: database, 16 tables, indexes, buckets, super-admin, Site
npm run seed:demo           # optional: demo gym "Iron Paradise Fitness" with 12 months of history
npm run dev
```

**Sign-in details**
- **Super-admin:** created by `setup:appwrite`. The one-time password is written to `./.superadmin-credentials`. Sign in, change the password, then delete the file.
- **Demo gym owner:** written to `.dev/demo-credentials` by the seed script.
- **Gym sites in dev:** open `http://<slug>.localhost:<port>` (for example `ironparadise.localhost:3000`). Browsers resolve `*.localhost` automatically.

### Environment
Copy `.env.example` to `.env.local` and fill it in. These values must be set:

| Variable | Purpose |
|---|---|
| `APPWRITE_API_KEY` | Server key. Used only on the server; never sent to the browser |
| `APP_SECRET`, `CRON_SECRET` | Random 32+ byte secrets |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Master AvniX Twilio account |
| `TWILIO_EMAIL_FROM` | `noreply.gymos@avnix.in`. It must be on a domain verified in Twilio |
| `SUPER_ADMIN_EMAILS` | Comma-separated list. A user also needs the `superadmin` label |
| `ROOT_DOMAIN` | `gym.avnix.in` |

## Scripts

| Script | What it does |
|---|---|
| `npm run setup:appwrite` | Provisions or upgrades the schema, buckets, super-admin account and Site. Safe to re-run: it adds missing columns and indexes and never drops anything. |
| `npm run seed:demo [-- --reset]` | Loads the demo gym with members, memberships, GST invoices, payments, about 3.8k check-ins, leads, expenses and daily rollups. |
| `npm run deploy:site` | Syncs env vars to the Appwrite Site as secrets, uploads an allow-listed tarball, builds on Appwrite and activates the build. |
| `npm run deploy:functions` | Deploys `gymos-scheduler`, which runs every 30 minutes and calls `/api/cron/run`. |
| `npm run typecheck` / `npm run lint` | TypeScript checks and ESLint (includes the React Compiler rules). |

---

## Architecture

```
Browser ──► proxy.ts (host routing + optimistic auth gate)
             ├─ gym.avnix.in           → app: /login, /dashboard…, /admin…
             ├─ <slug>.gym.avnix.in    → /s/<slug>   (gym website)
             └─ custom domain          → /s/~<host>  (gym website)

Server Components / Server Actions ──► src/lib/services/*  (domain logic)
                                        └► src/lib/data/repo.ts (tenant-scoped TablesDB access, API key)
Browser ◄── Appwrite Realtime (15-min JWT; rows readable only by the gym's Team)
Appwrite Function gymos-scheduler ─(every 30 min)─► POST /api/cron/run  (journeys + Twilio sends + AvniX billing sync)
Twilio ─► POST /api/webhooks/twilio  (signature-verified delivery status)
```

### Tenancy and security model
- **One Appwrite Team per gym.** The team id is the gym id. Staff roles (owner, manager, frontdesk, trainer) are Team roles.
- **Row permissions are read-only for clients.**
  - Operational tables are readable by `team:<gymId>`, which lets Realtime work.
  - Financial tables are readable only by `team:<gymId>/owner|manager`.
  - Platform tables (`platform_*`, `rate_limits`) have no client access at all.
  - Every write goes through server actions using the API key.
- **Every query is scoped to the gym.** `repo(gymId)` adds `gymId` to all reads, stamps it on every write, and re-checks ownership before update and delete. Ids leaked from another gym return 404.
- **Permissions are checked in each action.** Each server action calls `requireCap(capability)` (see `src/lib/auth/rbac.ts`), independently of the UI and of `proxy.ts`.
- **Sessions** are stored in an httpOnly, SameSite=Lax cookie (Secure in production) that holds the Appwrite session secret. Stale cookies are cleared through `/auth/signout`.
- **Rate limits** are stored in Appwrite, so they hold across instances:
  - login: 30 attempts per IP and 8 per email every 15 minutes;
  - website lead form: per IP and per phone;
  - password change.
- **Audit log** records every sensitive action: access toggles, password resets, billing, check-in overrides, staff changes and impersonation.
- **Response headers:** strict CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy and Permissions-Policy (see `next.config.ts`).
- **One-time passwords** are generated with `crypto.randomInt`, shown exactly once, and never stored by us. Owners are forced to change them.
- **Gym access** is controlled by `status = active | suspended`. Suspended gyms see `/paused`, and the owner's sessions are revoked.

### Core domain rules
- **GST:** gym services are charged 5% without ITC (from 22 Sep 2025), SAC 999723. The rate is configurable and prices are tax-inclusive by default. In-state sales split into CGST + SGST; other states use IGST.
- **Invoice numbers** follow `INV/<FY>/<seq>`, where the sequence is an atomic `incrementRowColumn` on the gym row.
- **Payments** are allocated FIFO across the member's open invoices. Voiding an invoice is blocked if it has payments.
- **Freezing** a membership extends the expiry. Unfreezing early gives back the unused days.
- **Check-ins** are ignored if the same member checked in within the last hour. Members with expired, frozen or no plan are blocked unless staff choose "let in once", which is audited. Session and PT packs use up one session per check-in.
- **Daily rollups** (`daily_stats`) are updated with atomic increments, so dashboards read at most ~400 rows instead of scanning every check-in.
- **The journey engine** (`src/lib/domain/journeys.ts`) is pure and deterministic. It is idempotent through a unique `(gymId, dedupeKey)` index, and messages are only sent between 09:00 and 20:30 IST.

---

## Biometric attendance (fingerprint & face)

Research and design: `../research/05-biometric-attendance.md`. Every source ends in `recordPunch()` (`src/lib/services/attendance.ts`), which applies the front-desk access policy, de-duplicates replays and logs to the `punches` table (live on **Devices**).

| Device | How it connects | Endpoint |
|---|---|---|
| eSSL / ZKTeco / Realtime / BioMax / Identix (fingerprint, face, card) | Device menu → Comm → Cloud server (ADMS): `gym.avnix.in`, port 443 | `/iclock/cdata`, `/iclock/getrequest`, `/iclock/registry`, `/iclock/push` — identified by registered serial number |
| Hikvision face terminals | Web UI → HTTP listening → URL shown once in GymOS | `POST /api/devices/hik/<device-key>` |
| Anything else / scripts / future USB bridge | `Authorization: Bearer <device-key>` | `POST /api/devices/punch` `{ "userId": "140", "method": "fingerprint" }` |
| Any camera (laptop, tablet, USB webcam) | Face ID kiosk in the browser | `/kiosk` (staff session) — enrol from Member → Face ID |

- **Device user ID = number in the member code** (`M0140` → `140`).
- Face ID uses `@vladmandic/human` in the browser; models are copied to `public/models/human` by `npm run dev/build` (`scripts/sync-face-models.mjs`, gitignored). Only 1024-d embeddings are sent; they live in the private `face_profiles` table with consent time and staff name.
- Old ZKTeco firmware without HTTPS needs plain HTTP on port 80 for `/iclock/*` only.

## Platform pricing

Super admin → **Pricing** holds the fixed setup + monthly fee plans (row `pricing` in the private `platform_settings` table). New gyms pick a plan; the server applies its fees unless "custom pricing" is allowed and switched on for that gym.

## Going live (DNS, SSL, Twilio)

1. **DNS at Hostinger for avnix.in.** Add these records:
   - `A  gym    → 147.93.170.241`
   - `A  *.gym  → 147.93.170.241`
2. **Verify the proxy rules** in Appwrite (Console → Sites → gymos-web → Domains).
   - `gym.avnix.in` and each `<slug>.gym.avnix.in` rule verify automatically, and Let's Encrypt certificates are issued per rule.
   - To retry a gym's rule, use Admin → gym → Website & domain → **Re-check**.
3. **Custom domains.** The gym owner adds a `CNAME www → cloud.jagadeesh.site` (or an apex `A` record → the server IP). Then an admin connects the domain on the gym page. `APPWRITE_DOMAIN_TARGET_*` must match the Appwrite server's `_APP_DOMAIN_TARGET_*` settings.
4. **Twilio setup:**
   - **Per gym:** set the SMS Messaging Service SID (DLT-registered for India) and the WhatsApp sender, in the admin gym page → SMS & WhatsApp.
   - **Messages outside the 24-hour window:** these need Meta-approved WhatsApp Content templates. Put each template's `HX…` Content SID on the matching automation.
   - **Status callbacks:** `https://gym.avnix.in/api/webhooks/twilio`. Messages set this per message automatically once `APP_URL` is https.
5. Run `npm run deploy:site`, then `npm run deploy:functions`.

## Project layout

```
src/
  app/
    (gym)/            gym workspace: dashboard, front-desk, members, leads, billing, plans,
                      automations, finance, website, staff, settings  (+ _actions/*)
    admin/            super-admin console: overview, gyms (create / detail), billing, audit
    s/[site]/         public gym website (rendered for subdomains and custom domains)
    api/              cron + Twilio webhook
    login, auth/signout, paused, no-access
  components/
    ui/               shadcn primitives (restyled)
    kit/              design system: DataTable, StatCard, Segmented, TabsBar, AnimatedIcon, motion…
    charts/           bar-track, area-trend, dot-heatmap, gauge
    shell/            sidebar, command palette (⌘K), app shell
    feedback/         haptics + UI sounds
    realtime/         Appwrite Realtime provider + live refresh hooks
  lib/
    appwrite/         schema (single source of truth) + clients
    auth/             session, RBAC
    data/             tenant repo, audit, rate limit, daily stats
    domain/           pure logic: GST, memberships, playbooks, journeys, slugs, passwords
    services/         platform (provisioning, domains, AvniX billing), gym ops, messaging
    messaging/        Twilio SMS/WhatsApp/Email
appwrite/functions/scheduler   scheduled Function
scripts/                       setup, seed, deploy
```
