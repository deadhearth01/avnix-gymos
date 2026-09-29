"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";
import { z } from "zod";
import { safe, UserError } from "@/lib/actions";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, DEVICE_VENDORS, T } from "@/lib/appwrite/schema";
import { requireCap } from "@/lib/auth/session";
import { audit } from "@/lib/data/audit";
import { rateLimit } from "@/lib/data/rate-limit";
import { repo } from "@/lib/data/repo";
import { liveStatus } from "@/lib/domain/membership";
import {
  cleanupFaceProfiles,
  deleteFacePhoto,
  deleteFaceProfile,
  findFaceOwner,
  hashToken,
  identifyFace,
  newDeviceToken,
  recordPunch,
  saveFacePhoto,
  saveFaceProfile,
  validEmbedding,
} from "@/lib/services/attendance";
import type { Device, Member } from "@/lib/types";

const createSchema = z
  .object({
    name: z.string().trim().min(2, "Give the device a name").max(128),
    vendor: z.enum(DEVICE_VENDORS),
    serial: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((d) => d.vendor !== "zkteco" || (d.serial && /^[\w.-]{3,64}$/.test(d.serial)), {
    path: ["serial"],
    message: "Enter the serial number shown under System info → Device info",
  });

/** Register a device. Token-based devices get their secret once, in the response. */
export async function createDeviceAction(payload: z.input<typeof createSchema>) {
  return safe(async () => {
    const ctx = await requireCap("devices.manage");
    const d = createSchema.parse(payload);
    const { tables } = adminClient();
    if (d.vendor === "zkteco") {
      const taken = await tables.listRows({ databaseId: DB_ID, tableId: T.devices, queries: [Query.equal("serial", d.serial!), Query.limit(1)] });
      if (taken.rows.length) throw new UserError("A device with this serial number is already connected to GymOS.");
    }
    const token = d.vendor === "zkteco" ? null : newDeviceToken();
    const device = await repo(ctx.gymId).create<Device>(T.devices, {
      name: d.name,
      vendor: d.vendor,
      serial: d.serial ?? null,
      tokenHash: token ? hashToken(token) : null,
      enabled: true,
      punchCount: 0,
    });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "device.create", entity: "device", entityId: device.$id, summary: `${d.name} (${d.vendor})` });
    revalidatePath("/devices");
    return { id: device.$id, token };
  }, "Device added");
}

export async function updateDeviceAction(id: string, patch: { name?: string; enabled?: boolean }) {
  return safe(async () => {
    const ctx = await requireCap("devices.manage");
    const data = z.object({ name: z.string().trim().min(2).max(128).optional(), enabled: z.boolean().optional() }).parse(patch);
    await repo(ctx.gymId).update<Device>(T.devices, id, data);
    revalidatePath("/devices");
  }, "Device updated");
}

export async function rotateDeviceTokenAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("devices.manage");
    const r = repo(ctx.gymId);
    const device = await r.get<Device>(T.devices, id);
    if (device.vendor === "zkteco") throw new UserError("ZKTeco devices are identified by serial number and don't use a token.");
    const token = newDeviceToken();
    await r.update<Device>(T.devices, id, { tokenHash: hashToken(token) });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "device.rotate", entity: "device", entityId: id, summary: device.name });
    return { token };
  }, "New device key created — update it on the device");
}

export async function deleteDeviceAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("devices.manage");
    const r = repo(ctx.gymId);
    const device = await r.get<Device>(T.devices, id);
    await r.remove(T.devices, id);
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "device.delete", entity: "device", entityId: id, summary: device.name });
    revalidatePath("/devices");
  }, "Device removed");
}

/* ─────────────────────────── face ─────────────────────────── */

export async function enrollFaceAction(memberId: string, embeddings: number[][], consent: boolean, photo?: unknown) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    if (!consent) throw new UserError("The member must agree before their face is saved.");
    if (!Array.isArray(embeddings) || embeddings.length < 2 || embeddings.length > 5 || !embeddings.every(validEmbedding))
      throw new UserError("We couldn't read the face clearly. Try again in better light.");
    // the photo uploads while we check for duplicates; it's discarded if the face belongs to someone else
    const [member, owner, photoId] = await Promise.all([
      repo(ctx.gymId).get<Member>(T.members, memberId),
      findFaceOwner(ctx.gymId, embeddings, memberId),
      saveFacePhoto(memberId, photo).catch(() => null),
    ]);
    if (owner) {
      after(() => deleteFacePhoto(photoId));
      const other = await repo(ctx.gymId).find<Member>(T.members, owner.memberId);
      throw new UserError(
        `This face is already registered to ${other?.name ?? owner.name}${other?.code ? ` (${other.code})` : ""}. One person can have only one Face ID — delete it on their profile first if it was saved to the wrong member.`,
      );
    }
    const { rowId, oldPhoto } = await saveFaceProfile(ctx.gym, member, embeddings, ctx.user.name || ctx.user.email, photoId);
    // bookkeeping after the response, so saving feels instant
    after(async () => {
      await Promise.all([cleanupFaceProfiles(ctx.gymId, memberId, rowId).catch(() => {}), deleteFacePhoto(oldPhoto)]);
      await audit({
        gymId: ctx.gymId,
        actor: ctx.user,
        action: "face.enroll",
        entity: "member",
        entityId: memberId,
        summary: `Face ID for ${member.name} (consent recorded)`,
      });
    });
  }, "Face ID saved");
}

export async function deleteFaceAction(memberId: string) {
  return safe(async () => {
    const ctx = await requireCap("members.edit");
    const removed = await deleteFaceProfile(ctx.gymId, memberId);
    if (removed) after(() => audit({ gymId: ctx.gymId, actor: ctx.user, action: "face.delete", entity: "member", entityId: memberId }));
  }, "Face ID deleted");
}

export type KioskResult =
  | { state: "unknown"; score: number }
  | {
      state: "checked_in" | "duplicate" | "blocked";
      name: string;
      firstName: string;
      status: string;
      expiresAt: string | null;
      visitCount: number;
      score: number;
    };

/** Face kiosk: 1:N match on the server (several readings must agree), then the same access policy as the front desk. */
export async function identifyFaceAction(input: number[][] | number[]) {
  return safe(async (): Promise<KioskResult> => {
    const ctx = await requireCap("checkins.create");
    const readings = (Array.isArray(input[0]) ? input : [input]) as number[][];
    if (!readings.length || readings.length > 5 || !readings.every(validEmbedding)) throw new UserError("Face not clear enough.");
    if (!(await rateLimit(`face:${ctx.gymId}`, 120, 60, { failClosed: true }))) throw new UserError("Too many attempts. Wait a moment.");
    const match = await identifyFace(ctx.gymId, readings);
    if (!match.memberId) return { state: "unknown", score: match.score };
    const result = await recordPunch({ gym: ctx.gym, device: null, memberId: match.memberId, at: new Date(), method: "face" });
    const member = await repo(ctx.gymId).get<Member>(T.members, match.memberId);
    return {
      state: result === "checked_in" ? "checked_in" : result === "duplicate" ? "duplicate" : "blocked",
      name: member.name,
      firstName: member.name.split(" ")[0],
      status: liveStatus(member),
      expiresAt: member.expiresAt,
      visitCount: member.visitCount,
      score: match.score,
    };
  });
}
