import "server-only";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { rowPermissions } from "@/lib/data/repo";
import { dayKey } from "@/lib/domain/membership";
import { invalidateGym } from "@/lib/data/cache";

type Metric = "checkins" | "revenue" | "payments" | "newMembers" | "sales" | "leads";

/**
 * Atomic daily rollups: one row per gym per IST day. Dashboards read ≤ 400
 * rows instead of scanning every check-in / payment.
 */
export async function bumpStat(gymId: string, metrics: Partial<Record<Metric, number>>, at = new Date()) {
  invalidateGym(gymId);
  const { tables } = adminClient();
  const day = dayKey(at);
  const rowId = `${gymId}_${day.replace(/-/g, "")}`;
  const entries = Object.entries(metrics).filter(([, v]) => v) as [Metric, number][];
  if (!entries.length) return;
  const apply = () =>
    Promise.all(entries.map(([column, value]) => tables.incrementRowColumn({ databaseId: DB_ID, tableId: T.dailyStats, rowId, column, value })));
  try {
    await apply();
  } catch (e) {
    if (!isAppwriteError(e, 404)) return console.error("[stats]", e);
    try {
      await tables.createRow({
        databaseId: DB_ID,
        tableId: T.dailyStats,
        rowId,
        data: { gymId, day, ...Object.fromEntries(entries) },
        permissions: rowPermissions(T.dailyStats, gymId),
      });
    } catch (e2) {
      if (isAppwriteError(e2, 409)) await apply().catch((e3) => console.error("[stats]", e3));
      else console.error("[stats]", e2);
    }
  }
}
