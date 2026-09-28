"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safe, zMoney, zOptStr } from "@/lib/actions";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { requireCap } from "@/lib/auth/session";
import { audit } from "@/lib/data/audit";
import { repo } from "@/lib/data/repo";
import type { GymSite, Plan } from "@/lib/types";

const schema = z.object({
  gym: z.object({
    name: z.string().trim().min(2, "Enter your gym’s name").max(128),
    city: zOptStr(64),
    address: zOptStr(500),
    phone: zOptStr(20),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .refine((v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN, or leave it blank"),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  }),
  plans: z.array(z.object({ id: z.string().max(64), price: zMoney, active: z.boolean() })).max(50),
  site: z.object({
    tagline: z.string().trim().max(60).optional(),
    heroText: z.string().trim().max(220).optional(),
    hours: z
      .array(z.object({ days: z.string().trim().min(1).max(32), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }))
      .max(7),
    showPrices: z.boolean(),
    showTrial: z.boolean(),
  }),
});

/** Owner self-onboarding: save everything in one go, publish the website and leave onboarding. */
export async function completeOnboardingAction(payload: z.input<typeof schema>) {
  return safe(async () => {
    const ctx = await requireCap("settings.manage");
    const d = schema.parse(payload);
    const { tables, teams, users } = adminClient();
    let site: GymSite = {};
    try {
      site = ctx.gym.site ? (JSON.parse(ctx.gym.site) as GymSite) : {};
    } catch {
      /* start fresh */
    }
    const r = repo(ctx.gymId);
    // Only this gym's plans can be touched (repo enforces the gym scope).
    await Promise.all(d.plans.map((p) => r.update<Plan>(T.plans, p.id, { price: p.price, active: p.active })));
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: T.gyms,
      rowId: ctx.gymId,
      data: {
        name: d.gym.name,
        city: d.gym.city ?? null,
        address: d.gym.address ?? null,
        phone: d.gym.phone ?? null,
        gstin: d.gym.gstin || null,
        stateCode: d.gym.gstin?.slice(0, 2) || ctx.gym.stateCode,
        brandColor: d.gym.brandColor,
        siteEnabled: true,
        site: JSON.stringify({ ...site, ...d.site, tagline: d.site.tagline || site.tagline, heroText: d.site.heroText || site.heroText }),
      },
    });
    if (d.gym.name !== ctx.gym.name) await teams.updateName({ teamId: ctx.gymId, name: d.gym.name }).catch(() => {});
    const prefs = await users.getPrefs({ userId: ctx.user.$id });
    const { onboardingGymId: _done, ...rest } = prefs as Record<string, unknown>;
    void _done;
    await users.updatePrefs({ userId: ctx.user.$id, prefs: rest });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "gym.onboarded", entity: "gym", entityId: ctx.gymId, summary: "Owner finished setup" });
    revalidatePath("/", "layout");
  }, "Your gym is ready");
}
