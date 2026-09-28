import "server-only";
import { createHash } from "node:crypto";
import type { Models } from "node-appwrite";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";

/**
 * Fixed-window limiter persisted in Appwrite (works across serverless
 * instances). Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSec: number, opts: { failClosed?: boolean } = {}): Promise<boolean> {
  const { tables } = adminClient();
  const id = createHash("sha256").update(key).digest("hex").slice(0, 32);
  const now = Date.now();
  try {
    const row = await tables.getRow<Models.Row & { count: number; windowStart: number }>({ databaseId: DB_ID, tableId: T.rateLimits, rowId: id });
    if (now - row.windowStart > windowSec * 1000) {
      await tables.updateRow({ databaseId: DB_ID, tableId: T.rateLimits, rowId: id, data: { count: 1, windowStart: now } });
      return true;
    }
    if (row.count >= limit) return false;
    await tables.incrementRowColumn({ databaseId: DB_ID, tableId: T.rateLimits, rowId: id, column: "count", value: 1 });
    return true;
  } catch (e) {
    if (!isAppwriteError(e, 404)) {
      console.error("[rate-limit] storage error", e);
      return !opts.failClosed; // staff logins fail open; public forms fail closed
    }
    try {
      await tables.createRow({ databaseId: DB_ID, tableId: T.rateLimits, rowId: id, data: { count: 1, windowStart: now } });
    } catch {}
    return true;
  }
}
