import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ID, Query } from "node-appwrite";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { repo, rowPermissions } from "@/lib/data/repo";
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

export const FACE_MODEL = "human-faceres-3.3";
export const FACE_DIM = 1024;
export const FACE_MATCH = 0.62;
const FACE_MARGIN = 0.05;

/** Same maths as @vladmandic/human `match.similarity` (order 2, multiplier 25, min 0.2, max 0.8). */
export function faceSimilarity(a: ArrayLike<number>, b: ArrayLike<number>) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const dist = Math.round(100 * 25 * sum) / 100;
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
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
const galleries = new Map<string, Gallery>();
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
      [Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : []), Query.select(["$id", "memberId", "memberName", "embeddings"])],
      false,
    );
    for (const row of page.rows) {
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

/** 1:N search across the gym's enrolled faces. Embeddings never leave the server. */
export async function identifyFace(gymId: string, embedding: number[]) {
  const faces = await gallery(gymId);
  let best = { memberId: "", name: "", score: 0 };
  let second = 0;
  for (const f of faces) {
    const score = Math.max(...f.vecs.map((v) => faceSimilarity(embedding, v)));
    if (score > best.score) {
      second = best.score;
      best = { memberId: f.memberId, name: f.name, score };
    } else if (score > second) second = score;
  }
  const matched = best.score >= FACE_MATCH && best.score - second >= FACE_MARGIN;
  return { matched, memberId: matched ? best.memberId : null, score: best.score, enrolled: faces.length };
}

export async function saveFaceProfile(gym: Gym, member: Member, embeddings: number[][], consentBy: string) {
  const r = repo(gym.$id);
  const existing = (await r.list<FaceProfile>(T.faceProfiles, [Query.equal("memberId", member.$id), Query.limit(1)], false)).rows[0];
  const data = {
    memberId: member.$id,
    memberName: member.name,
    embeddings: JSON.stringify(embeddings.slice(0, 5).map(encodeEmbedding)),
    model: FACE_MODEL,
    consentAt: new Date().toISOString(),
    consentBy,
  };
  if (existing) await r.update<FaceProfile>(T.faceProfiles, existing.$id, data);
  else await r.create<FaceProfile>(T.faceProfiles, data, ID.unique());
  forgetGallery(gym.$id);
}

export async function deleteFaceProfile(gymId: string, memberId: string) {
  const r = repo(gymId);
  const rows = (await r.list<FaceProfile>(T.faceProfiles, [Query.equal("memberId", memberId), Query.limit(5)], false)).rows;
  await Promise.all(rows.map((x) => r.remove(T.faceProfiles, x.$id)));
  forgetGallery(gymId);
  return rows.length > 0;
}

export async function hasFaceProfile(gymId: string, memberId: string) {
  return (await repo(gymId).count(T.faceProfiles, [Query.equal("memberId", memberId)])) > 0;
}
