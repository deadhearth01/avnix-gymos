import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ID, Query } from "node-appwrite";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { InputFile } from "node-appwrite/file";
import { BUCKETS, DB_ID, T } from "@/lib/appwrite/schema";
import { repo, rowPermissions } from "@/lib/data/repo";
import { invalidateGym } from "@/lib/data/cache";
import { FACE_DIM, FACE_MODEL } from "@/lib/domain/face";
import { CAN_ENTER, liveStatus } from "@/lib/domain/membership";
import { checkIn } from "@/lib/services/gym";
import type { Checkin, Device, FaceProfile, Gym, Member, Punch } from "@/lib/types";

/* ─────────────────────────── device credentials ─────────────────────────── */

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newDeviceToken = () => `gdv_${randomBytes(24).toString("base64url")}`;

/** Active device + its gym, looked up by the credential the vendor protocol gives us. */
export async function findDevice(by: { serial: string } | { token: string }): Promise<{ device: Device; gym: Gym } | null> {
  const { tables } = adminClient();
  const queries =
    "serial" in by
      ? [Query.equal("serial", by.serial.slice(0, 64)), Query.equal("vendor", "zkteco"), Query.limit(1)]
      : [Query.equal("tokenHash", hashToken(by.token)), Query.limit(1)];
  const { rows } = await tables.listRows<Device>({ databaseId: DB_ID, tableId: T.devices, queries });
  const device = rows[0];
  if (!device?.enabled) return null;
  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: device.gymId }).catch(() => null);
  if (!gym || gym.status !== "active") return null;
  return { device, gym };
}

export async function touchDevice(device: Device, ip: string | null, info?: Record<string, string>) {
  const { tables } = adminClient();
  const data: Partial<Device> = { lastSeenAt: new Date().toISOString(), lastIp: ip?.slice(0, 64) ?? null };
  if (info && Object.keys(info).length) data.info = JSON.stringify(info).slice(0, 4000);
  await tables.updateRow({ databaseId: DB_ID, tableId: T.devices, rowId: device.$id, data }).catch(() => {});
}

/* ─────────────────────────── members ↔ device user IDs ─────────────────────────── */

/** The number on a member's code is their device user ID: `M0140` ↔ `140`. */
export function deviceUserId(code: string | null | undefined) {
  const digits = (code ?? "").replace(/\D/g, "");
  return digits ? String(Number(digits)) : null;
}

async function memberForUserId(gymId: string, userId: string) {
  const raw = userId.trim();
  const n = /^\d{1,9}$/.test(raw) ? Number(raw) : Number(raw.replace(/^[A-Za-z]+/, ""));
  const candidates = new Set<string>([raw.toUpperCase()]);
  if (Number.isFinite(n) && n > 0) candidates.add(`M${String(n).padStart(4, "0")}`);
  const { rows } = await repo(gymId).list<Member>(T.members, [Query.equal("code", [...candidates]), Query.limit(1)], false);
  return rows[0] ?? null;
}

/* ─────────────────────────── punches ─────────────────────────── */

export type PunchInput = {
  gym: Gym;
  device: Device | null;
  userId?: string;
  memberId?: string;
  at: Date;
  method: Checkin["method"];
};

const MAX_FUTURE_MS = 10 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * One pipeline for every device: resolve the member, apply the front-desk access policy,
 * record the visit and keep an auditable punch log. Replays of the same punch are ignored.
 */
export async function recordPunch(p: PunchInput): Promise<Punch["result"]> {
  const { tables } = adminClient();
  const now = Date.now();
  let at = p.at;
  if (!Number.isFinite(at.getTime()) || at.getTime() > now + MAX_FUTURE_MS) at = new Date(now); // device clock ahead → use server time
  const userId = (p.userId ?? p.memberId ?? "").slice(0, 32);
  const punchId = createHash("sha256")
    .update(`${p.gym.$id}|${p.device?.$id ?? "kiosk"}|${userId}|${at.toISOString().slice(0, 19)}`)
    .digest("hex")
    .slice(0, 32);
  if (await tables.getRow({ databaseId: DB_ID, tableId: T.punches, rowId: punchId }).catch(() => null)) return "duplicate";

  let result: Punch["result"] = "ignored";
  let member: Member | null = null;
  let note: string | null = null;
  if (now - at.getTime() > MAX_AGE_MS) note = "Older than 7 days — not counted";
  else {
    member = p.memberId ? await repo(p.gym.$id).find<Member>(T.members, p.memberId) : await memberForUserId(p.gym.$id, userId);
    if (!member) result = "unknown";
    else {
      const status = liveStatus(member, at);
      if (!CAN_ENTER.includes(status)) {
        result = "blocked";
        note = `Plan ${status}`;
      } else {
        const r = await checkIn(p.gym, member.$id, p.method, { $id: p.device?.$id ?? "kiosk", name: p.device?.name ?? "Face kiosk" }, at);
        result = r.duplicate ? "duplicate" : "checked_in";
      }
    }
  }

  try {
    await tables.createRow({
      databaseId: DB_ID,
      tableId: T.punches,
      rowId: punchId,
      data: {
        gymId: p.gym.$id,
        deviceId: p.device?.$id ?? null,
        deviceName: p.device?.name ?? "Face kiosk",
        userId: userId || "?",
        at: at.toISOString(),
        method: p.method,
        result,
        memberId: member?.$id ?? null,
        memberName: member?.name ?? null,
        note,
      },
      permissions: rowPermissions(T.punches, p.gym.$id),
    });
  } catch (e) {
    if (isAppwriteError(e) && e.code === 409) return "duplicate"; // a concurrent replay won the race
    throw e;
  }
  if (p.device) {
    await tables
      .updateRow({ databaseId: DB_ID, tableId: T.devices, rowId: p.device.$id, data: { lastPunchAt: at.toISOString(), lastSeenAt: new Date().toISOString() } })
      .catch(() => {});
    await tables.incrementRowColumn({ databaseId: DB_ID, tableId: T.devices, rowId: p.device.$id, column: "punchCount", value: 1 }).catch(() => {});
  }
  return result;
}

/* ─────────────────────────── face recognition ─────────────────────────── */

export { FACE_DIM, FACE_MODEL };
/** Cosine similarity needed to call it the same person (tested: same person ≥ 0.82, look-alikes ≤ 0.66). */
export const FACE_MATCH = 0.7;
/** …and this far ahead of the next-closest member. */
const FACE_MARGIN = 0.08;

/** Cosine similarity of two embeddings, 0…1 (negatives clamp to 0). */
export function faceSimilarity(a: ArrayLike<number>, b: ArrayLike<number>) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return Math.round(1000 * Math.max(0, dot / Math.sqrt(na * nb))) / 1000;
}

export function encodeEmbedding(v: number[]) {
  return Buffer.from(new Float32Array(v).buffer).toString("base64");
}
function decodeEmbedding(s: string) {
  const buf = Buffer.from(s, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function validEmbedding(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === FACE_DIM && v.every((x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) < 10);
}

type Gallery = { at: number; faces: { memberId: string; name: string; vecs: Float32Array[] }[] };
// shared across route bundles (see lib/data/cache.ts), so enrolling in one route refreshes the kiosk's route
const galleries = ((globalThis as typeof globalThis & { __gymosFaces?: Map<string, Gallery> }).__gymosFaces ??= new Map<string, Gallery>());
const GALLERY_TTL = 60_000;

export function forgetGallery(gymId: string) {
  galleries.delete(gymId);
}

async function gallery(gymId: string) {
  const hit = galleries.get(gymId);
  if (hit && Date.now() - hit.at < GALLERY_TTL) return hit.faces;
  const faces: Gallery["faces"] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await repo(gymId).list<FaceProfile>(
      T.faceProfiles,
      [Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : []), Query.select(["$id", "memberId", "memberName", "embeddings", "model"])],
      false,
    );
    for (const row of page.rows) {
      if (row.model !== FACE_MODEL) continue; // enrolled with an older model — must be re-enrolled
      try {
        const vecs = (JSON.parse(row.embeddings) as string[]).map(decodeEmbedding).filter((v) => v.length === FACE_DIM);
        if (vecs.length) faces.push({ memberId: row.memberId, name: row.memberName ?? "", vecs });
      } catch {
        /* skip corrupt row */
      }
    }
    if (page.rows.length < 500) break;
    cursor = page.rows[page.rows.length - 1].$id;
  }
  galleries.set(gymId, { at: Date.now(), faces });
  return faces;
}

/**
 * 1:N search across the gym's enrolled faces. Embeddings never leave the server.
 * Several readings (different frames) vote: a member is recognised only when at least two readings
 * independently pick the same person with a clear lead over the next-closest member.
 */
export async function identifyFace(gymId: string, readings: number[][]) {
  const faces = await gallery(gymId);
  const votes = new Map<string, { n: number; best: number; name: string }>();
  let top = 0;
  for (const e of readings) {
    let best = { memberId: "", name: "", score: 0 };
    let second = 0;
    for (const f of faces) {
      const sims = f.vecs.map((v) => faceSimilarity(e, v)).sort((a, b) => b - a);
      // mean of the two closest samples: steadier than a single best frame
      const score = sims.length > 1 ? (sims[0] + sims[1]) / 2 : sims[0];
      if (score > best.score) {
        second = best.score;
        best = { memberId: f.memberId, name: f.name, score };
      } else if (score > second) second = score;
    }
    top = Math.max(top, best.score);
    if (best.score >= FACE_MATCH && best.score - second >= FACE_MARGIN) {
      const v = votes.get(best.memberId) ?? { n: 0, best: 0, name: best.name };
      v.n++;
      v.best = Math.max(v.best, best.score);
      votes.set(best.memberId, v);
    }
  }
  const needed = Math.min(2, readings.length);
  const winner = [...votes.entries()].sort((a, b) => b[1].n - a[1].n || b[1].best - a[1].best)[0];
  const matched = !!winner && winner[1].n >= needed && votes.size === 1;
  return { matched, memberId: matched ? winner[0] : null, score: winner?.[1].best ?? top, enrolled: faces.length };
}

/** One row per member, written with a single upsert — re-enrolling replaces it (reuses an older row's id if present). */
export async function saveFaceProfile(gym: Gym, member: Member, embeddings: number[][], consentBy: string, photoFileId: string | null) {
  const { tables } = adminClient();
  const existing = await repo(gym.$id).list<FaceProfile>(
    T.faceProfiles,
    [Query.equal("memberId", member.$id), Query.select(["$id", "photoFileId"]), Query.limit(1)],
    false,
  );
  const rowId = existing.rows[0]?.$id ?? `face-${member.$id}`;
  const oldPhoto = existing.rows[0]?.photoFileId;
  await tables.upsertRow({
    databaseId: DB_ID,
    tableId: T.faceProfiles,
    rowId,
    data: {
      gymId: gym.$id,
      memberId: member.$id,
      memberName: member.name,
      embeddings: JSON.stringify(embeddings.slice(0, 5).map(encodeEmbedding)),
      model: FACE_MODEL,
      photoFileId,
      consentAt: new Date().toISOString(),
      consentBy,
    },
    permissions: [],
  });
  forgetGallery(gym.$id);
  invalidateGym(gym.$id);
  return { rowId, oldPhoto: oldPhoto && oldPhoto !== photoFileId ? oldPhoto : null };
}

/**
 * The enrolment reference photo (a JPEG data URL from the browser) → the private member-photos bucket.
 * Nobody can read it directly; staff see it through /api/face/photo, which checks their session.
 */
export async function saveFacePhoto(memberId: string, dataUrl: unknown) {
  const m = typeof dataUrl === "string" ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 1500 || buf.length > 400_000 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // real JPEG, sane size
  const { storage } = adminClient();
  const f = await storage.createFile({
    bucketId: BUCKETS.memberPhotos,
    fileId: ID.unique(),
    file: InputFile.fromBuffer(buf, `face-${memberId}.jpg`),
    permissions: [],
  });
  return f.$id;
}

export async function deleteFacePhoto(fileId: string | null | undefined) {
  if (!fileId) return;
  await adminClient()
    .storage.deleteFile({ bucketId: BUCKETS.memberPhotos, fileId })
    .catch(() => {});
}

export async function facePhoto(fileId: string) {
  const bytes = await adminClient().storage.getFileView({ bucketId: BUCKETS.memberPhotos, fileId });
  return Buffer.from(bytes);
}

/** Remove older rows for this member (saved before profiles had a fixed id). */
export async function cleanupFaceProfiles(gymId: string, memberId: string, keepId: string) {
  const r = repo(gymId);
  const rows = (await r.list<FaceProfile>(T.faceProfiles, [Query.equal("memberId", memberId), Query.notEqual("$id", keepId), Query.limit(10)], false)).rows;
  await Promise.all(rows.map((x) => Promise.all([r.remove(T.faceProfiles, x.$id), deleteFacePhoto(x.photoFileId)])));
}

/**
 * Is this face already enrolled for someone else at the gym? Compares every new sample with every
 * enrolled face (except this member's own), so one person can't hold two Face IDs.
 */
export async function findFaceOwner(gymId: string, embeddings: number[][], excludeMemberId: string) {
  const faces = await gallery(gymId);
  let best: { memberId: string; name: string; score: number } | null = null;
  for (const f of faces) {
    if (f.memberId === excludeMemberId) continue;
    for (const e of embeddings)
      for (const v of f.vecs) {
        const score = faceSimilarity(e, v);
        if (score >= FACE_MATCH && (!best || score > best.score)) best = { memberId: f.memberId, name: f.name, score };
      }
  }
  return best;
}

export async function deleteFaceProfile(gymId: string, memberId: string) {
  const r = repo(gymId);
  const rows = (await r.list<FaceProfile>(T.faceProfiles, [Query.equal("memberId", memberId), Query.limit(5)], false)).rows;
  await Promise.all(rows.map((x) => Promise.all([r.remove(T.faceProfiles, x.$id), deleteFacePhoto(x.photoFileId)])));
  forgetGallery(gymId);
  invalidateGym(gymId);
  return rows.length > 0;
}

export async function hasFaceProfile(gymId: string, memberId: string) {
  return (await repo(gymId).count(T.faceProfiles, [Query.equal("memberId", memberId)])) > 0;
}
