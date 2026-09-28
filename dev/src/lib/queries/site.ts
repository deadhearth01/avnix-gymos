import "server-only";

import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { BUCKETS, DB_ID, T } from "@/lib/appwrite/schema";
import { repo } from "@/lib/data/repo";
import { env } from "@/lib/env";
import { presetUrl } from "@/lib/site/presets";
import type { Gym, GymSite, Plan } from "@/lib/types";

export async function resolveSite(site: string): Promise<Gym | null> {
  let value: string;
  try {
    value = decodeURIComponent(site);
  } catch {
    return null;
  }
  const custom = value.startsWith("~");
  const key = custom ? value.slice(1).toLowerCase() : value.toLowerCase();
  if (!key || key.length > 253) return null;
  const queries = custom
    ? [Query.equal("customDomain", key), Query.equal("customDomainEnabled", true), Query.limit(1)]
    : [Query.equal("slug", key), Query.limit(1)];
  const result = await adminClient().tables.listRows<Gym>({ databaseId: DB_ID, tableId: T.gyms, queries });
  return result.rows[0] ?? null;
}

export function parseSite(gym: Gym): GymSite {
  if (!gym.site) return {};
  try {
    const value: unknown = JSON.parse(gym.site);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as GymSite) : {};
  } catch {
    return {};
  }
}

export async function sitePlans(gymId: string): Promise<Plan[]> {
  const result = await repo(gymId).list<Plan>(T.plans, [Query.equal("active", true), Query.orderAsc("sortOrder"), Query.limit(100)], false);
  return result.rows;
}

export function mediaUrl(fileId: string | null | undefined, width?: number): string | null {
  if (!fileId) return null;
  const bundled = presetUrl(fileId, (width ?? 2000) <= 700 ? "sm" : "lg");
  if (bundled) return bundled;
  const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } = env();
  const base = `${APPWRITE_ENDPOINT.replace(/\/$/, "")}/storage/buckets/${BUCKETS.gymMedia}/files/${encodeURIComponent(fileId)}`;
  return width
    ? `${base}/preview?project=${encodeURIComponent(APPWRITE_PROJECT_ID)}&width=${width}&quality=80&output=webp`
    : `${base}/view?project=${encodeURIComponent(APPWRITE_PROJECT_ID)}`;
}

export function safeBrandColor(value: string | null): string | null {
  return value && /^#[\da-fA-F]{6}$/.test(value) ? value : null;
}
