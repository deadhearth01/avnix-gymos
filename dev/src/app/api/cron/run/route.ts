import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { env } from "@/lib/env";
import { runJourneysForGym } from "@/lib/services/messages";
import { syncPlatformInvoices } from "@/lib/services/platform";
import type { Gym } from "@/lib/types";

export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called every 30 minutes by the `gymos-scheduler` Appwrite Function.
 * Runs every active gym's journeys (queue + auto-send) and syncs AvniX billing.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = Date.now();
  const { tables } = adminClient();
  const gyms: Gym[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await tables.listRows<Gym>({
      databaseId: DB_ID,
      tableId: T.gyms,
      queries: [Query.notEqual("status", "archived"), Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    gyms.push(...page.rows);
    if (page.rows.length < 100) break;
    cursor = page.rows[page.rows.length - 1].$id;
  }
  const results: Record<string, unknown>[] = [];
  for (const gym of gyms) {
    const r: Record<string, unknown> = { gym: gym.slug };
    try {
      await syncPlatformInvoices(gym.$id);
    } catch (e) {
      r.billingError = (e as Error).message;
    }
    if (gym.status === "active") {
      try {
        Object.assign(r, await runJourneysForGym(gym, { maxSend: 100 }));
      } catch (e) {
        r.journeyError = (e as Error).message;
      }
    }
    results.push(r);
    if (Date.now() - started > 270_000) break; // stay inside the function timeout
  }
  return NextResponse.json({ ok: true, gyms: results.length, ms: Date.now() - started, results });
}
