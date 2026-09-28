import "server-only";
import { addMonths, isAfter, isBefore } from "date-fns";
import { ID, Permission, Query, Role } from "node-appwrite";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { env } from "@/lib/env";
import { generatePassword } from "@/lib/domain/password";
import { isValidDomain, slugify, validateSlug } from "@/lib/domain/slug";
import { PLAYBOOKS } from "@/lib/domain/playbooks";
import { rowPermissions } from "@/lib/data/repo";
import { credentialsEmail, isEmailReady, sendEmail } from "@/lib/messaging/email";
import type { Gym, PlatformInvoice, PlatformSubscription } from "@/lib/types";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function gymSubdomain(slug: string) {
  return `${slug}.${env().ROOT_DOMAIN}`;
}
export function gymSiteUrl(g: Pick<Gym, "slug" | "customDomain" | "customDomainEnabled" | "customDomainStatus">) {
  if (g.customDomainEnabled && g.customDomain && g.customDomainStatus === "verified") return `https://${g.customDomain}`;
  return `https://${gymSubdomain(g.slug)}`;
}
export function loginUrl() {
  const e = env();
  return e.APP_URL.includes("localhost") ? `${e.APP_URL}/login` : `https://${e.ROOT_DOMAIN}/login`;
}

export async function isSlugAvailable(slug: string, exceptGymId?: string) {
  const { tables } = adminClient();
  const r = await tables.listRows({ databaseId: DB_ID, tableId: T.gyms, queries: [Query.equal("slug", slug), Query.limit(1)] });
  return r.rows.length === 0 || r.rows[0].$id === exceptGymId;
}

export async function suggestSlug(name: string) {
  const base = slugify(name) || "gym";
  if (!validateSlug(base) && (await isSlugAvailable(base))) return base;
  for (let i = 2; i < 50; i++) {
    const s = `${base.slice(0, 36)}-${i}`;
    if (!validateSlug(s) && (await isSlugAvailable(s))) return s;
  }
  return `${base.slice(0, 30)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ─────────────────────────── Provisioning ─────────────────────────── */

export type CreateGymInput = {
  name: string;
  slug: string;
  city?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  owner: { name: string; email: string; phone?: string };
  subscription: {
    planName: string;
    setupFee: number;
    setupFeeStatus: "due" | "paid" | "waived";
    monthlyFee: number;
    billingMonths: number;
    billingStartAt: string;
    gstRate: number;
    autoSuspend: boolean;
    graceDays: number;
  };
  twilio: { smsServiceSid?: string; whatsappFrom?: string; whatsappServiceSid?: string };
  emailOwner: boolean;
};

export type CreateGymResult = {
  gymId: string;
  slug: string;
  siteUrl: string;
  loginUrl: string;
  credentials: { email: string; password: string | null; existingAccount: boolean };
  emailed: boolean;
  emailError?: string;
  domainWarning?: string;
};

const DEFAULT_PLANS = [
  {
    name: "Monthly",
    type: "duration",
    durationDays: 30,
    price: 1500,
    joiningFee: 0,
    sortOrder: 1,
    color: "#16a34a",
    featured: false,
    description: "Full gym access for 30 days.",
  },
  {
    name: "Quarterly",
    type: "duration",
    durationDays: 90,
    price: 4000,
    joiningFee: 0,
    sortOrder: 2,
    color: "#3b82f6",
    featured: true,
    description: "3 months · best for building the habit.",
  },
  {
    name: "Half-yearly",
    type: "duration",
    durationDays: 180,
    price: 7500,
    joiningFee: 0,
    sortOrder: 3,
    color: "#7c3aed",
    featured: false,
    description: "6 months of unlimited access.",
  },
  {
    name: "Annual",
    type: "duration",
    durationDays: 365,
    price: 13999,
    joiningFee: 0,
    sortOrder: 4,
    color: "#f59e0b",
    featured: true,
    description: "12 months · lowest monthly cost.",
  },
  {
    name: "Personal Training · 12 sessions",
    type: "pt",
    durationDays: 45,
    sessions: 12,
    price: 6000,
    joiningFee: 0,
    sortOrder: 5,
    color: "#ef4444",
    featured: false,
    description: "12 one-on-one sessions with a certified trainer.",
  },
] as const;

export async function createGym(input: CreateGymInput, actor: { $id: string; name?: string }): Promise<CreateGymResult> {
  const { tables, users, teams, proxy } = adminClient();
  const slugErr = validateSlug(input.slug);
  if (slugErr) throw new Error(`Subdomain: ${slugErr}`);
  if (!(await isSlugAvailable(input.slug))) throw new Error("That subdomain is already taken.");

  const email = input.owner.email.trim().toLowerCase();
  const gymId = ID.unique();
  const cleanup: (() => Promise<unknown>)[] = [];
  let password: string | null = null;
  let existingAccount = false;

  try {
    // 1 · Owner account (reuse if the person already has one, e.g. multi-gym owner)
    const found = await users.list({ queries: [Query.equal("email", email), Query.limit(1)] });
    let ownerId: string;
    if (found.users[0]) {
      ownerId = found.users[0].$id;
      existingAccount = true;
    } else {
      password = generatePassword();
      const u = await users.create({ userId: ID.unique(), email, password, name: input.owner.name.trim() });
      ownerId = u.$id;
      cleanup.push(() => users.delete({ userId: ownerId }));
      await users.updateEmailVerification({ userId: ownerId, emailVerification: true });
      await users.updatePrefs({ userId: ownerId, prefs: { mustChangePassword: true } });
    }

    // 2 · Team = tenant boundary (Realtime + row permissions use it)
    await teams.create({ teamId: gymId, name: input.name.trim(), roles: ["owner", "manager", "frontdesk", "trainer"] });
    cleanup.push(() => teams.delete({ teamId: gymId }));
    await teams.createMembership({ teamId: gymId, roles: ["owner"], userId: ownerId });

    // 3 · Gym row
    await tables.createRow({
      databaseId: DB_ID,
      tableId: T.gyms,
      rowId: gymId,
      data: {
        name: input.name.trim(),
        slug: input.slug,
        city: input.city?.trim() || null,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email,
        gstin: input.gstin?.trim().toUpperCase() || null,
        stateCode: input.gstin?.trim().slice(0, 2) || "37",
        ownerUserId: ownerId,
        ownerName: input.owner.name.trim(),
        ownerEmail: email,
        ownerPhone: input.owner.phone?.trim() || null,
        twilioSmsServiceSid: input.twilio.smsServiceSid?.trim() || null,
        twilioWhatsappFrom: input.twilio.whatsappFrom?.trim() || null,
        twilioWhatsappServiceSid: input.twilio.whatsappServiceSid?.trim() || null,
        messagingEnabled: Boolean(input.twilio.smsServiceSid || input.twilio.whatsappFrom || input.twilio.whatsappServiceSid),
        site: JSON.stringify({
          tagline: `Train smarter at ${input.name.trim()}`,
          about: `${input.name.trim()} is a modern fitness centre${input.city ? ` in ${input.city}` : ""} with expert trainers, quality equipment and flexible memberships.`,
          amenities: ["Certified trainers", "Cardio zone", "Free weights", "Locker rooms", "Personal training", "Diet guidance"],
          hours: [
            { days: "Mon – Sat", open: "05:00", close: "22:00" },
            { days: "Sunday", open: "06:00", close: "12:00" },
          ],
          showPrices: true,
        }),
        settings: JSON.stringify({}),
      },
      permissions: [Permission.read(Role.team(gymId))],
    });
    cleanup.push(() => tables.deleteRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId }));

    // 4 · Starter plans + automations
    await tables.createRows({
      databaseId: DB_ID,
      tableId: T.plans,
      rows: DEFAULT_PLANS.map((p) => ({ $id: ID.unique(), $permissions: rowPermissions(T.plans, gymId), gymId, sessions: 0, active: true, ...p })),
    });
    await tables.createRows({
      databaseId: DB_ID,
      tableId: T.automations,
      rows: PLAYBOOKS.map((p) => ({
        $id: ID.unique(),
        $permissions: rowPermissions(T.automations, gymId),
        gymId,
        key: p.key,
        enabled: p.defaultEnabled,
        channel: "whatsapp",
        config: JSON.stringify({ offsets: p.defaultOffsets ?? [] }),
      })),
    });

    // 5 · Subscription + first invoices
    await tables.createRow({
      databaseId: DB_ID,
      tableId: T.platformSubscriptions,
      rowId: gymId,
      data: { gymId, ...input.subscription, status: "active", nextBillingAt: input.subscription.billingStartAt },
    });
  } catch (e) {
    for (const undo of cleanup.reverse()) await undo().catch(() => {});
    if (isAppwriteError(e, 409)) throw new Error("A gym or account with these details already exists.");
    throw e;
  }

  await syncPlatformInvoices(gymId).catch((e) => console.error("[billing sync]", e));

  // 6 · Website subdomain → Appwrite Site (best effort; retried from the gym page)
  let domainWarning: string | undefined;
  try {
    const rule = await proxy.createSiteRule({ domain: gymSubdomain(input.slug), siteId: env().APPWRITE_SITE_ID });
    await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { subdomainRuleId: rule.$id } });
  } catch (e) {
    domainWarning = `Website subdomain not attached yet: ${(e as Error).message}`;
  }

  // 7 · Credentials email
  let emailed = false;
  let emailError: string | undefined;
  if (input.emailOwner && password) {
    try {
      await sendCredentials({ gymName: input.name, ownerName: input.owner.name, email, password, slug: input.slug });
      emailed = true;
    } catch (e) {
      emailError = (e as Error).message;
    }
  }

  void actor;
  return {
    gymId,
    slug: input.slug,
    siteUrl: `https://${gymSubdomain(input.slug)}`,
    loginUrl: loginUrl(),
    credentials: { email, password, existingAccount },
    emailed,
    emailError,
    domainWarning,
  };
}

export async function sendCredentials({
  gymName,
  ownerName,
  email,
  password,
  slug,
}: {
  gymName: string;
  ownerName: string;
  email: string;
  password: string;
  slug: string;
}) {
  if (!isEmailReady()) throw new Error("Email isn't configured on the server.");
  const msg = credentialsEmail({ gymName, ownerName, email, password, loginUrl: loginUrl(), siteUrl: `https://${gymSubdomain(slug)}` });
  await sendEmail({ to: email, toName: ownerName, ...msg, tag: "gym-credentials" });
}

export async function resetOwnerPassword(gymId: string) {
  const { tables, users } = adminClient();
  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
  if (!gym.ownerUserId) throw new Error("This gym has no owner account.");
  const password = generatePassword();
  await users.updatePassword({ userId: gym.ownerUserId, password });
  await users.updatePrefs({ userId: gym.ownerUserId, prefs: { mustChangePassword: true } });
  await users.deleteSessions({ userId: gym.ownerUserId }); // sign out everywhere
  return { email: gym.ownerEmail ?? "", password, gym };
}

export async function setGymStatus(gymId: string, status: "active" | "suspended") {
  const { tables, users } = adminClient();
  const gym = await tables.updateRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { status } });
  if (status === "suspended" && gym.ownerUserId) await users.deleteSessions({ userId: gym.ownerUserId }).catch(() => {});
  return gym;
}

/* ─────────────────────────── Domains ─────────────────────────── */

export async function attachSubdomain(gymId: string) {
  const { tables, proxy } = adminClient();
  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
  if (gym.subdomainRuleId) {
    try {
      const rule = await proxy.getRule({ ruleId: gym.subdomainRuleId });
      if (rule.status !== "verified") return proxy.updateRuleStatus({ ruleId: rule.$id });
      return rule;
    } catch (e) {
      if (!isAppwriteError(e, 404)) throw e;
    }
  }
  const rule = await proxy.createSiteRule({ domain: gymSubdomain(gym.slug), siteId: env().APPWRITE_SITE_ID });
  await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { subdomainRuleId: rule.$id } });
  return rule;
}

export async function connectCustomDomain(gymId: string, rawDomain: string) {
  const domain = rawDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!isValidDomain(domain)) throw new Error("Enter a valid domain like www.yourgym.in");
  if (domain.endsWith(`.${env().ROOT_DOMAIN}`) || domain === env().ROOT_DOMAIN) throw new Error("Use the built-in subdomain instead.");
  const { tables, proxy } = adminClient();
  const clash = await tables.listRows({ databaseId: DB_ID, tableId: T.gyms, queries: [Query.equal("customDomain", domain), Query.limit(1)] });
  if (clash.rows[0] && clash.rows[0].$id !== gymId) throw new Error("That domain is connected to another gym.");

  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
  if (gym.customDomainRuleId) await proxy.deleteRule({ ruleId: gym.customDomainRuleId }).catch(() => {});

  let ruleId: string | null = null;
  let status: Gym["customDomainStatus"] = "pending";
  try {
    const rule = await proxy.createSiteRule({ domain, siteId: env().APPWRITE_SITE_ID });
    ruleId = rule.$id;
    status = rule.status === "verified" ? "verified" : "pending";
  } catch (e) {
    if (!isAppwriteError(e, 409)) throw e;
    throw new Error("That domain is already registered on the hosting server.");
  }
  return tables.updateRow<Gym>({
    databaseId: DB_ID,
    tableId: T.gyms,
    rowId: gymId,
    data: { customDomain: domain, customDomainEnabled: true, customDomainRuleId: ruleId, customDomainStatus: status },
  });
}

export async function refreshCustomDomain(gymId: string) {
  const { tables, proxy } = adminClient();
  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
  if (!gym.customDomainRuleId) return { gym, logs: "" };
  let rule = await proxy.getRule({ ruleId: gym.customDomainRuleId });
  if (rule.status !== "verified") {
    try {
      rule = await proxy.updateRuleStatus({ ruleId: rule.$id });
    } catch (e) {
      const updated = await tables.updateRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { customDomainStatus: "failed" } });
      return { gym: updated, logs: (e as Error).message };
    }
  }
  const status: Gym["customDomainStatus"] = rule.status === "verified" ? "verified" : "pending";
  const updated = await tables.updateRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { customDomainStatus: status } });
  return { gym: updated, logs: rule.logs ?? "" };
}

export async function disconnectCustomDomain(gymId: string) {
  const { tables, proxy } = adminClient();
  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
  if (gym.customDomainRuleId) await proxy.deleteRule({ ruleId: gym.customDomainRuleId }).catch(() => {});
  return tables.updateRow<Gym>({
    databaseId: DB_ID,
    tableId: T.gyms,
    rowId: gymId,
    data: { customDomain: null, customDomainEnabled: false, customDomainRuleId: null, customDomainStatus: "none" },
  });
}

export function dnsTargets() {
  return {
    cname: process.env.APPWRITE_DOMAIN_TARGET_CNAME || new URL(env().APPWRITE_ENDPOINT).hostname,
    a: process.env.APPWRITE_DOMAIN_TARGET_A || "",
  };
}

/* ─────────────────────────── Platform billing ─────────────────────────── */

function invoiceNumber(gymId: string, slug: string, kind: "setup" | "monthly" | "other", seq: number) {
  // slug prefix for readability + gym-id tail for global uniqueness
  const code = `${slug.replace(/-/g, "").slice(0, 8)}${gymId.slice(-4)}`.toUpperCase();
  return `AVX-${code}-${kind === "setup" ? "SETUP" : `M${String(seq).padStart(3, "0")}`}`;
}

/**
 * Idempotently materialises the setup invoice and every monthly invoice
 * whose period has started, marks overdue ones, advances nextBillingAt and
 * applies auto-suspension. Safe to run any number of times.
 */
export async function syncPlatformInvoices(gymId: string, now = new Date()) {
  const { tables } = adminClient();
  const [gym, sub] = await Promise.all([
    tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId }),
    tables.getRow<PlatformSubscription>({ databaseId: DB_ID, tableId: T.platformSubscriptions, rowId: gymId }),
  ]);
  const { rows: existing } = await tables.listRows<PlatformInvoice>({
    databaseId: DB_ID,
    tableId: T.platformInvoices,
    queries: [Query.equal("gymId", gymId), Query.limit(500)],
  });
  const has = (kind: string, seq: number) => existing.some((i) => i.kind === kind && i.sequence === seq);
  const start = sub.billingStartAt ? new Date(sub.billingStartAt) : new Date(sub.$createdAt);
  const gst = sub.gstRate ?? 18;
  const mk = (
    kind: "setup" | "monthly",
    seq: number,
    amount: number,
    periodStart: Date,
    periodEnd: Date | null,
    description: string,
    status: PlatformInvoice["status"],
  ) =>
    tables.createRow({
      databaseId: DB_ID,
      tableId: T.platformInvoices,
      rowId: ID.unique(),
      data: {
        gymId,
        gymName: gym.name,
        number: invoiceNumber(gymId, gym.slug, kind, seq),
        kind,
        sequence: seq,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd?.toISOString() ?? null,
        description,
        amount: r2(amount),
        gstRate: gst,
        tax: r2((amount * gst) / 100),
        total: r2(amount * (1 + gst / 100)),
        status,
        dueAt: periodStart.toISOString(),
        paidAt: status === "paid" ? now.toISOString() : null,
      },
    });

  if (sub.setupFee > 0 && !has("setup", 0)) {
    await mk(
      "setup",
      0,
      sub.setupFee,
      start,
      null,
      "One-time setup & onboarding",
      sub.setupFeeStatus === "paid" ? "paid" : sub.setupFeeStatus === "waived" ? "waived" : "due",
    );
  }

  let next: Date | null = null;
  if (sub.monthlyFee > 0 && (sub.status === "active" || sub.status === "trial")) {
    for (let i = 0; i < 600; i++) {
      if (sub.billingMonths > 0 && i >= sub.billingMonths) break;
      const ps = addMonths(start, i);
      if (isAfter(ps, now)) {
        next = ps;
        break;
      }
      if (!has("monthly", i + 1)) {
        const pe = addMonths(start, i + 1);
        await mk(
          "monthly",
          i + 1,
          sub.monthlyFee,
          ps,
          pe,
          `Maintenance & service — month ${i + 1}${sub.billingMonths ? ` of ${sub.billingMonths}` : ""}`,
          "due",
        );
      }
    }
  }

  // overdue + auto-suspend
  const fresh = await tables.listRows<PlatformInvoice>({
    databaseId: DB_ID,
    tableId: T.platformInvoices,
    queries: [Query.equal("gymId", gymId), Query.equal("status", ["due", "overdue"]), Query.limit(500)],
  });
  let overdueBeyondGrace = false;
  for (const inv of fresh.rows) {
    if (!inv.dueAt) continue;
    const graceEnd = new Date(new Date(inv.dueAt).getTime() + (sub.graceDays ?? 7) * 86_400_000);
    if (isBefore(graceEnd, now)) {
      overdueBeyondGrace = true;
      if (inv.status !== "overdue") await tables.updateRow({ databaseId: DB_ID, tableId: T.platformInvoices, rowId: inv.$id, data: { status: "overdue" } });
    }
  }
  const completed = sub.billingMonths > 0 && !next && sub.monthlyFee > 0 && isAfter(now, addMonths(start, sub.billingMonths));
  await tables.updateRow({
    databaseId: DB_ID,
    tableId: T.platformSubscriptions,
    rowId: gymId,
    data: { nextBillingAt: next?.toISOString() ?? null, ...(completed && sub.status === "active" ? { status: "completed" } : {}) },
  });
  if (sub.autoSuspend && overdueBeyondGrace && gym.status === "active") await setGymStatus(gymId, "suspended");
}

export async function setPlatformInvoiceStatus(invoiceId: string, status: "paid" | "waived" | "void" | "due", meta?: { method?: string; reference?: string }) {
  const { tables } = adminClient();
  const inv = await tables.updateRow<PlatformInvoice>({
    databaseId: DB_ID,
    tableId: T.platformInvoices,
    rowId: invoiceId,
    data: { status, paidAt: status === "paid" ? new Date().toISOString() : null, method: meta?.method ?? null, reference: meta?.reference ?? null },
  });
  if (inv.kind === "setup") {
    await tables
      .updateRow({
        databaseId: DB_ID,
        tableId: T.platformSubscriptions,
        rowId: inv.gymId,
        data: { setupFeeStatus: status === "paid" ? "paid" : status === "waived" ? "waived" : "due" },
      })
      .catch(() => {});
  }
  return inv;
}
