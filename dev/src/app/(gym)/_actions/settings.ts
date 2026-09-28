"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { z } from "zod";
import { getGymContext, requireCap } from "@/lib/auth/session";
import { safe, UserError, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { adminClient, sessionClient, isAppwriteError } from "@/lib/appwrite/server";
import { BUCKETS, DB_ID, T } from "@/lib/appwrite/schema";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { rateLimit } from "@/lib/data/rate-limit";
import type { GymSite } from "@/lib/types";

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(128),
  phone: zOptStr(20),
  email: z.union([z.email(), z.literal("")]).optional(),
  city: zOptStr(64),
  address: zOptStr(500),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "Enter a valid 15-character GSTIN"),
  gstRate: z.coerce.number().min(0).max(28),
  gstInclusive: z.boolean(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
});

export async function updateGymSettingsAction(payload: z.input<typeof settingsSchema>) {
  return safe(async () => {
    const ctx = await requireCap("settings.manage");
    const d = settingsSchema.parse(payload);
    const { tables, teams } = adminClient();
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: T.gyms,
      rowId: ctx.gymId,
      data: {
        ...d,
        phone: d.phone ?? null,
        email: d.email || null,
        city: d.city ?? null,
        address: d.address ?? null,
        gstin: d.gstin || null,
        stateCode: d.gstin?.slice(0, 2) || ctx.gym.stateCode,
      },
    });
    if (d.name !== ctx.gym.name) await teams.updateName({ teamId: ctx.gymId, name: d.name }).catch(() => {});
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "settings.update",
      entity: "gym",
      entityId: ctx.gymId,
      summary: `GST ${d.gstRate}% ${d.gstInclusive ? "incl." : "excl."}`,
    });
    revalidatePath("/", "layout");
  }, "Settings saved");
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif", "image/svg+xml"]);

async function uploadImage(file: File, gymId: string) {
  if (!(file instanceof File) || file.size === 0) throw new UserError("Choose an image.");
  if (file.size > 8 * 1024 * 1024) throw new UserError("Images must be under 8 MB.");
  if (!IMAGE_TYPES.has(file.type)) throw new UserError("Use a PNG, JPG, WebP, AVIF, GIF or SVG image.");
  const { storage } = adminClient();
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "img";
  const buf = Buffer.from(await file.arrayBuffer());
  const f = await storage.createFile({ bucketId: BUCKETS.gymMedia, fileId: ID.unique(), file: InputFile.fromBuffer(buf, `${gymId}-${Date.now()}.${ext}`) });
  return f.$id;
}

export async function uploadLogoAction(form: FormData) {
  return safe(async () => {
    const ctx = await requireCap("settings.manage");
    const id = await uploadImage(form.get("file") as File, ctx.gymId);
    const { tables, storage } = adminClient();
    if (ctx.gym.logoFileId) await storage.deleteFile({ bucketId: BUCKETS.gymMedia, fileId: ctx.gym.logoFileId }).catch(() => {});
    await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: ctx.gymId, data: { logoFileId: id } });
    revalidatePath("/", "layout");
    return { fileId: id };
  }, "Logo updated");
}

export async function uploadSiteImageAction(form: FormData) {
  return safe(async () => {
    const ctx = await requireCap("website.manage");
    const id = await uploadImage(form.get("file") as File, ctx.gymId);
    return { fileId: id };
  });
}

/** Files uploaded through GymOS are named `<gymId>-…` server-side; that name is the ownership proof. */
async function ownsFile(gymId: string, fileId: string) {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(fileId)) return false;
  try {
    const f = await adminClient().storage.getFile({ bucketId: BUCKETS.gymMedia, fileId });
    return f.name.startsWith(`${gymId}-`);
  } catch {
    return false;
  }
}

export async function deleteSiteImageAction(fileId: string) {
  return safe(async () => {
    const ctx = await requireCap("website.manage");
    const site: GymSite = ctx.gym.site ? JSON.parse(ctx.gym.site) : {};
    const referenced = site.heroFileId === fileId || site.gallery?.includes(fileId) || site.trainers?.some((t) => t.photoFileId === fileId);
    if (referenced) throw new UserError("Remove the image from your site and publish before deleting it.");
    if (!(await ownsFile(ctx.gymId, fileId))) throw new UserError("That image isn't yours.");
    await adminClient()
      .storage.deleteFile({ bucketId: BUCKETS.gymMedia, fileId })
      .catch(() => {});
  });
}

const siteSchema = z.object({
  siteEnabled: z.boolean(),
  site: z.object({
    tagline: z.string().trim().max(140).optional(),
    about: z.string().trim().max(2000).optional(),
    heroFileId: z.string().max(64).optional(),
    gallery: z.array(z.string().max(64)).max(24).optional(),
    amenities: z.array(z.string().trim().min(1).max(48)).max(24).optional(),
    hours: z
      .array(z.object({ days: z.string().trim().max(32), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }))
      .max(7)
      .optional(),
    socials: z
      .object({
        instagram: z.string().max(200).optional(),
        facebook: z.string().max(200).optional(),
        youtube: z.string().max(200).optional(),
        google: z.string().max(300).optional(),
      })
      .optional(),
    mapUrl: z.string().max(500).optional(),
    faqs: z
      .array(z.object({ q: z.string().trim().min(1).max(200), a: z.string().trim().min(1).max(1000) }))
      .max(12)
      .optional(),
    trainers: z
      .array(z.object({ name: z.string().trim().min(1).max(64), role: z.string().trim().max(64), photoFileId: z.string().max(64).optional() }))
      .max(12)
      .optional(),
    showPrices: z.boolean().optional(),
  }),
});

export async function updateSiteAction(payload: z.input<typeof siteSchema>) {
  return safe(async () => {
    const ctx = await requireCap("website.manage");
    const d = siteSchema.parse(payload);
    const { tables, storage } = adminClient();
    // every referenced image must have been uploaded by this gym
    const referencedIds = [d.site.heroFileId, ...(d.site.gallery ?? []), ...(d.site.trainers ?? []).map((t) => t.photoFileId)].filter(Boolean) as string[];
    const owned = await Promise.all(referencedIds.map((id) => ownsFile(ctx.gymId, id)));
    if (owned.some((o) => !o)) throw new UserError("One of the images doesn't belong to your gym. Re-upload it and try again.");
    const fileIds = (x: GymSite) => new Set([x.heroFileId, ...(x.gallery ?? []), ...(x.trainers ?? []).map((t) => t.photoFileId)].filter(Boolean) as string[]);
    const before: GymSite = (() => {
      try {
        return ctx.gym.site ? JSON.parse(ctx.gym.site) : {};
      } catch {
        return {};
      }
    })();
    await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: ctx.gymId, data: { siteEnabled: d.siteEnabled, site: JSON.stringify(d.site) } });
    // Only after the new site is live: reclaim images that are no longer referenced.
    const keep = fileIds(d.site as GymSite);
    const removedCandidates = [...fileIds(before)].filter((id) => !keep.has(id) && id !== ctx.gym.logoFileId);
    const removed = (await Promise.all(removedCandidates.map(async (id) => ((await ownsFile(ctx.gymId, id)) ? id : null)))).filter(Boolean) as string[];
    await Promise.all(removed.map((fileId) => storage.deleteFile({ bucketId: BUCKETS.gymMedia, fileId }).catch(() => {})));
    await audit({
      gymId: ctx.gymId,
      actor: ctx.user,
      action: "website.update",
      entity: "gym",
      entityId: ctx.gymId,
      summary: removed.length ? `${removed.length} image(s) removed` : undefined,
    });
    revalidatePath("/website");
    revalidatePath(`/s/${ctx.gym.slug}`);
  }, "Website published");
}

const pwSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), next: z.string().min(10, "Use at least 10 characters").max(128), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => /[a-z]/.test(v.next) && /[A-Z]/.test(v.next) && /\d/.test(v.next), { path: ["next"], message: "Mix upper & lower case letters and a number" });

export async function changePasswordAction(payload: z.input<typeof pwSchema>) {
  return safe(async () => {
    const ctx = await getGymContext().catch(() => null);
    const d = pwSchema.parse(payload);
    const secret = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!secret) throw new UserError("Please sign in again.");
    const { account } = sessionClient(secret);
    const me = await account.get();
    if (!(await rateLimit(`pw:${me.$id}`, 5, 15 * 60))) throw new UserError("Too many attempts. Try again in 15 minutes.");
    try {
      await account.updatePassword({ password: d.next, oldPassword: d.current });
    } catch (e) {
      if (isAppwriteError(e, 401)) throw new UserError("Your current password is incorrect.");
      if (isAppwriteError(e, 400)) throw new UserError("Choose a stronger password that you haven't used before.");
      throw e;
    }
    await adminClient().users.updatePrefs({ userId: me.$id, prefs: { ...me.prefs, mustChangePassword: false } });
    await audit({ gymId: ctx?.gymId, actor: me, action: "account.password_change", entity: "user", entityId: me.$id });
  }, "Password changed");
}
