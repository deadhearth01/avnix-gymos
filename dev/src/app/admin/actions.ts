"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/session";
import { GYM_COOKIE } from "@/lib/auth/cookies";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { safe, UserError, zMoney, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { validateSlug } from "@/lib/domain/slug";
import { toE164 } from "@/lib/format";
import { lookupMessagingService } from "@/lib/messaging/twilio";
import {
  attachSubdomain,
  connectCustomDomain,
  createGym,
  disconnectCustomDomain,
  isSlugAvailable,
  refreshCustomDomain,
  resetOwnerPassword,
  sendCredentials,
  setGymStatus,
  setPlatformInvoiceStatus,
  suggestSlug,
  syncPlatformInvoices,
} from "@/lib/services/platform";
import type { Gym } from "@/lib/types";
import { getPricing, planFor, savePricing, type Pricing } from "@/lib/services/pricing";

const zSid = (prefix: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || new RegExp(`^${prefix}[0-9a-fA-F]{32}$`).test(v), `Must start with ${prefix} followed by 32 hex characters`);

const zWaFrom = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? (toE164(v.replace(/^whatsapp:/, "")) ?? "__invalid__") : undefined))
  .refine((v) => v !== "__invalid__", "Enter the WhatsApp number in international format, e.g. +91 98765 43210");

const createSchema = z.object({
  onboarding: z.boolean().default(false),
  name: z.string().trim().min(2, "Gym name is required").max(128),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((s, ctx) => {
      const err = validateSlug(s);
      if (err) ctx.addIssue({ code: "custom", message: err });
    }),
  city: zOptStr(64),
  address: zOptStr(500),
  phone: zOptStr(20),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN"),
  owner: z.object({
    name: z.string().trim().min(2, "Owner name is required").max(128),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    phone: zOptStr(20),
  }),
  subscription: z.object({
    planName: z.string().trim().min(1).max(64).default("Growth"),
    setupFee: zMoney,
    setupFeeStatus: z.enum(["due", "paid", "waived"]).default("due"),
    monthlyFee: zMoney,
    billingMonths: z.coerce.number().int().min(0).max(120),
    billingStartAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Pick a start date"),
    gstRate: z.coerce.number().min(0).max(28).default(18),
    autoSuspend: z.boolean().default(false),
    graceDays: z.coerce.number().int().min(0).max(90).default(7),
  }),
  twilio: z.object({ smsServiceSid: zSid("MG"), whatsappFrom: zWaFrom, whatsappServiceSid: zSid("MG") }),
  emailOwner: z.boolean().default(true),
  /** From /admin/pricing. Unless custom pricing is allowed and chosen, the plan's fees override the payload. */
  pricingPlanId: z.string().max(40).optional(),
  customPricing: z.boolean().default(false),
});
export type CreateGymPayload = z.input<typeof createSchema>;

export async function createGymAction(payload: CreateGymPayload) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const parsed = createSchema.parse(payload);
    const pricing = await getPricing();
    const custom = parsed.customPricing && pricing.allowCustom;
    const plan = planFor(pricing, parsed.pricingPlanId);
    const input = custom
      ? parsed
      : {
          ...parsed,
          subscription: {
            ...parsed.subscription,
            planName: plan.name,
            setupFee: plan.setupFee,
            monthlyFee: plan.monthlyFee,
            billingMonths: plan.billingMonths,
            gstRate: plan.gstRate,
            graceDays: plan.graceDays,
            autoSuspend: plan.autoSuspend,
          },
        };
    const result = await createGym(
      { ...input, subscription: { ...input.subscription, billingStartAt: new Date(input.subscription.billingStartAt).toISOString() } },
      user,
    );
    await audit({
      actor: user,
      action: "gym.create",
      entity: "gym",
      entityId: result.gymId,
      summary: `Created ${input.name} (${input.slug}) for ${input.owner.email}`,
    });
    revalidatePath("/admin", "layout");
    return result;
  });
}

export async function checkSlugAction(slug: string) {
  await requireSuperAdmin();
  const s = slug.trim().toLowerCase();
  const err = validateSlug(s);
  if (err) return { available: false, error: err };
  const available = await isSlugAvailable(s);
  return { available, error: available ? undefined : "Already taken" };
}

export async function suggestSlugAction(name: string) {
  await requireSuperAdmin();
  return suggestSlug(name);
}

export async function setGymStatusAction(gymId: string, status: "active" | "suspended") {
  return safe(
    async () => {
      const { user } = await requireSuperAdmin();
      const gym = await setGymStatus(gymId, status);
      await audit({
        actor: user,
        action: status === "active" ? "gym.access.enable" : "gym.access.disable",
        entity: "gym",
        entityId: gymId,
        summary: `${gym.name}: access ${status === "active" ? "enabled" : "suspended"}`,
      });
      revalidatePath("/admin", "layout");
      return { status: gym.status };
    },
    status === "active" ? "Access enabled" : "Access paused",
  );
}

export async function resetOwnerPasswordAction(gymId: string) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const r = await resetOwnerPassword(gymId);
    await audit({ actor: user, action: "gym.owner.password_reset", entity: "gym", entityId: gymId, summary: `Password reset for ${r.email}` });
    return { email: r.email, password: r.password, gymName: r.gym.name, slug: r.gym.slug, ownerName: r.gym.ownerName ?? "" };
  });
}

export async function emailCredentialsAction(gymId: string, password: string) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new UserError("Invalid password.");
    const { tables } = adminClient();
    const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
    if (!gym.ownerEmail) throw new UserError("This gym has no owner email.");
    await sendCredentials({ gymName: gym.name, ownerName: gym.ownerName ?? "", email: gym.ownerEmail, password, slug: gym.slug });
    await audit({ actor: user, action: "gym.owner.credentials_emailed", entity: "gym", entityId: gymId, summary: `Credentials emailed to ${gym.ownerEmail}` });
    return { to: gym.ownerEmail };
  }, "Login details emailed");
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(128),
  city: zOptStr(64),
  address: zOptStr(500),
  phone: zOptStr(20),
  ownerName: z.string().trim().min(2).max(128),
  ownerPhone: zOptStr(20),
});

export async function updateGymProfileAction(gymId: string, payload: z.input<typeof profileSchema>) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const d = profileSchema.parse(payload);
    const { tables, teams } = adminClient();
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: T.gyms,
      rowId: gymId,
      data: {
        name: d.name,
        city: d.city ?? null,
        address: d.address ?? null,
        phone: d.phone ?? null,
        ownerName: d.ownerName,
        ownerPhone: d.ownerPhone ?? null,
      },
    });
    await teams.updateName({ teamId: gymId, name: d.name }).catch(() => {});
    await audit({ actor: user, action: "gym.profile.update", entity: "gym", entityId: gymId, summary: `Profile updated` });
    revalidatePath(`/admin/gyms/${gymId}`);
  }, "Gym details saved");
}

const subSchema = z.object({
  planName: z.string().trim().min(1).max(64),
  setupFee: zMoney,
  setupFeeStatus: z.enum(["due", "paid", "waived"]),
  monthlyFee: zMoney,
  billingMonths: z.coerce.number().int().min(0).max(120),
  billingStartAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Pick a start date"),
  status: z.enum(["trial", "active", "paused", "cancelled", "completed"]),
  gstRate: z.coerce.number().min(0).max(28),
  autoSuspend: z.boolean(),
  graceDays: z.coerce.number().int().min(0).max(90),
  notes: zOptStr(2000),
});

export async function updateSubscriptionAction(gymId: string, payload: z.input<typeof subSchema>) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const d = subSchema.parse(payload);
    const { tables } = adminClient();
    await tables.upsertRow({
      databaseId: DB_ID,
      tableId: T.platformSubscriptions,
      rowId: gymId,
      data: { gymId, ...d, billingStartAt: new Date(d.billingStartAt).toISOString(), notes: d.notes ?? null },
    });
    // keep the setup invoice in step with the setup-fee status
    const setup = await tables.listRows({
      databaseId: DB_ID,
      tableId: T.platformInvoices,
      queries: [Query.equal("gymId", gymId), Query.equal("kind", "setup"), Query.limit(1)],
    });
    if (setup.rows[0]) {
      const map = { due: "due", paid: "paid", waived: "waived" } as const;
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: T.platformInvoices,
        rowId: setup.rows[0].$id,
        data: {
          status: map[d.setupFeeStatus],
          amount: d.setupFee,
          tax: Math.round(d.setupFee * d.gstRate) / 100,
          total: Math.round(d.setupFee * (100 + d.gstRate)) / 100,
        },
      });
    }
    await syncPlatformInvoices(gymId);
    await audit({
      actor: user,
      action: "gym.subscription.update",
      entity: "gym",
      entityId: gymId,
      summary: `Setup ₹${d.setupFee} (${d.setupFeeStatus}), ₹${d.monthlyFee}/mo × ${d.billingMonths || "∞"} from ${d.billingStartAt}, ${d.status}`,
    });
    revalidatePath("/admin", "layout");
  }, "Subscription updated");
}

export async function setPlatformInvoiceStatusAction(
  invoiceId: string,
  status: "paid" | "waived" | "void" | "due",
  meta?: { method?: string; reference?: string },
) {
  return safe(
    async () => {
      const { user } = await requireSuperAdmin();
      const inv = await setPlatformInvoiceStatus(invoiceId, status, { method: meta?.method?.slice(0, 32), reference: meta?.reference?.slice(0, 64) });
      await audit({ actor: user, action: `platform_invoice.${status}`, entity: "platform_invoice", entityId: invoiceId, summary: `${inv.number} → ${status}` });
      revalidatePath("/admin", "layout");
    },
    status === "paid" ? "Marked as paid" : "Invoice updated",
  );
}

const messagingSchema = z.object({
  smsServiceSid: zSid("MG"),
  whatsappFrom: zWaFrom,
  whatsappServiceSid: zSid("MG"),
  messagingEnabled: z.boolean(),
  autoSend: z.boolean(),
});

export async function updateMessagingAction(gymId: string, payload: z.input<typeof messagingSchema>) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const d = messagingSchema.parse(payload);
    const { tables } = adminClient();
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: T.gyms,
      rowId: gymId,
      data: {
        twilioSmsServiceSid: d.smsServiceSid ?? null,
        twilioWhatsappFrom: d.whatsappFrom ?? null,
        twilioWhatsappServiceSid: d.whatsappServiceSid ?? null,
        messagingEnabled: d.messagingEnabled,
        autoSend: d.autoSend,
      },
    });
    await audit({
      actor: user,
      action: "gym.messaging.update",
      entity: "gym",
      entityId: gymId,
      summary: `SMS ${d.smsServiceSid ? "set" : "—"}, WhatsApp ${d.whatsappFrom || d.whatsappServiceSid ? "set" : "—"}, enabled=${d.messagingEnabled}, auto=${d.autoSend}`,
    });
    revalidatePath(`/admin/gyms/${gymId}`);
  }, "Messaging settings saved");
}

export async function validateTwilioServiceAction(sid: string) {
  await requireSuperAdmin();
  return lookupMessagingService(sid.trim());
}

export async function connectDomainAction(gymId: string, domain: string) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const gym = await connectCustomDomain(gymId, domain);
    await audit({ actor: user, action: "gym.domain.connect", entity: "gym", entityId: gymId, summary: `Custom domain ${gym.customDomain}` });
    revalidatePath(`/admin/gyms/${gymId}`);
    return { status: gym.customDomainStatus, domain: gym.customDomain };
  }, "Domain added — waiting for DNS");
}

export async function refreshDomainAction(gymId: string) {
  return safe(async () => {
    await requireSuperAdmin();
    const r = await refreshCustomDomain(gymId);
    revalidatePath(`/admin/gyms/${gymId}`);
    return { status: r.gym.customDomainStatus, logs: r.logs };
  });
}

export async function disconnectDomainAction(gymId: string) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    await disconnectCustomDomain(gymId);
    await audit({ actor: user, action: "gym.domain.disconnect", entity: "gym", entityId: gymId, summary: "Custom domain removed" });
    revalidatePath(`/admin/gyms/${gymId}`);
  }, "Custom domain removed");
}

export async function toggleCustomDomainAction(gymId: string, enabled: boolean) {
  return safe(async () => {
    await requireSuperAdmin();
    const { tables } = adminClient();
    await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { customDomainEnabled: enabled } });
    revalidatePath(`/admin/gyms/${gymId}`);
  });
}

export async function attachSubdomainAction(gymId: string) {
  return safe(async () => {
    await requireSuperAdmin();
    const rule = await attachSubdomain(gymId);
    revalidatePath(`/admin/gyms/${gymId}`);
    return { status: rule.status };
  }, "Subdomain re-checked");
}

export async function openWorkspaceAction(gymId: string) {
  const { user } = await requireSuperAdmin();
  const jar = await cookies();
  jar.set(GYM_COOKIE, gymId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  await audit({ gymId, actor: user, action: "admin.impersonate", entity: "gym", entityId: gymId, summary: "Super-admin opened the gym workspace" });
  redirect("/dashboard");
}

export async function exitWorkspaceAction() {
  await requireSuperAdmin();
  (await cookies()).delete(GYM_COOKIE);
  redirect("/admin/gyms");
}

export async function searchGymsAction(q: string) {
  await requireSuperAdmin();
  const { tables } = adminClient();
  const term = q.trim().slice(0, 64);
  if (term.length < 2) return [];
  const [byName, bySlug] = await Promise.all([
    tables.listRows<Gym>({ databaseId: DB_ID, tableId: T.gyms, queries: [Query.search("name", term), Query.limit(6)] }).catch(() => ({ rows: [] as Gym[] })),
    tables
      .listRows<Gym>({ databaseId: DB_ID, tableId: T.gyms, queries: [Query.startsWith("slug", term.toLowerCase()), Query.limit(6)] })
      .catch(() => ({ rows: [] as Gym[] })),
  ]);
  const seen = new Set<string>();
  return [...byName.rows, ...bySlug.rows]
    .filter((g) => (seen.has(g.$id) ? false : (seen.add(g.$id), true)))
    .map((g) => ({ id: g.$id, title: g.name, subtitle: `${g.slug} · ${g.city ?? ""}`, href: `/admin/gyms/${g.$id}` }));
}

export async function syncAllBillingAction() {
  return safe(async () => {
    await requireSuperAdmin();
    const { tables } = adminClient();
    const subs = await tables.listRows({ databaseId: DB_ID, tableId: T.platformSubscriptions, queries: [Query.limit(500)] });
    for (const s of subs.rows) await syncPlatformInvoices((s as unknown as { gymId: string }).gymId).catch((e) => console.error(e));
    revalidatePath("/admin", "layout");
    return { synced: subs.rows.length };
  }, "Billing synced");
}

const pricingSchema = z
  .object({
    plans: z
      .array(
        z.object({
          id: z
            .string()
            .trim()
            .regex(/^[a-z0-9-]{1,40}$/),
          name: z.string().trim().min(1, "Name the plan").max(64),
          description: z.string().trim().max(160).default(""),
          setupFee: zMoney,
          monthlyFee: zMoney,
          billingMonths: z.coerce.number().int().min(0).max(120),
          gstRate: z.coerce.number().min(0).max(28),
          graceDays: z.coerce.number().int().min(0).max(90),
          autoSuspend: z.boolean(),
        }),
      )
      .min(1, "Keep at least one plan")
      .max(12),
    defaultPlanId: z.string(),
    allowCustom: z.boolean(),
  })
  .refine((p) => p.plans.some((x) => x.id === p.defaultPlanId), { path: ["defaultPlanId"], message: "Pick a default plan" })
  .refine((p) => new Set(p.plans.map((x) => x.id)).size === p.plans.length, { path: ["plans"], message: "Plan names must be different" });

/** AvniX price list (setup + monthly fees) used when creating gyms. */
export async function savePricingAction(payload: z.input<typeof pricingSchema>) {
  return safe(async () => {
    const { user } = await requireSuperAdmin();
    const pricing: Pricing = pricingSchema.parse(payload);
    await savePricing(pricing);
    await audit({
      actor: user,
      action: "pricing.update",
      entity: "platform",
      entityId: "pricing",
      summary: pricing.plans.map((p) => `${p.name}: ₹${p.setupFee} + ₹${p.monthlyFee}/mo`).join("; "),
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/admin/gyms/new");
  }, "Pricing saved");
}
