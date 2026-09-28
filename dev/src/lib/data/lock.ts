import "server-only";
import { createHash } from "node:crypto";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { UserError } from "@/lib/actions";

const TTL_MS = 30_000;

/**
 * Short-lived mutual exclusion backed by a unique row id (works across
 * serverless instances). Used to serialise money movements per member and
 * message delivery per message. Stale locks (>30s) are taken over.
 */
export async function withLock<R>(key: string, fn: () => Promise<R>, waitMs = 8000): Promise<R> {
  const { tables } = adminClient();
  const rowId = `lk_${createHash("sha256").update(key).digest("hex").slice(0, 30)}`;
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      await tables.createRow({ databaseId: DB_ID, tableId: T.rateLimits, rowId, data: { count: 1, windowStart: Date.now() } });
      break;
    } catch (e) {
      if (!isAppwriteError(e, 409)) throw e;
      const row = await tables
        .getRow<{ windowStart: number } & import("node-appwrite").Models.Row>({ databaseId: DB_ID, tableId: T.rateLimits, rowId })
        .catch(() => null);
      if (row && Date.now() - row.windowStart > TTL_MS) {
        await tables.deleteRow({ databaseId: DB_ID, tableId: T.rateLimits, rowId }).catch(() => {});
        continue;
      }
      if (Date.now() > deadline) throw new UserError("Another update is in progress for this record. Please try again.");
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 150));
    }
  }
  try {
    return await fn();
  } finally {
    await tables.deleteRow({ databaseId: DB_ID, tableId: T.rateLimits, rowId }).catch(() => {});
  }
}
