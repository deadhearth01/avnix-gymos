import "server-only";
import { ID } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { rowPermissions } from "@/lib/data/repo";
import { clientIp } from "@/lib/auth/session";
import { invalidateGym } from "@/lib/data/cache";

type AuditInput = {
  gymId?: string | null;
  actor: { $id: string; name?: string; email?: string };
  action: string;
  entity?: string;
  entityId?: string;
  summary?: string;
};

/** Append-only audit trail. Never throws — auditing must not break the action. */
export async function audit(a: AuditInput) {
  invalidateGym(a.gymId);
  try {
    const { tables } = adminClient();
    await tables.createRow({
      databaseId: DB_ID,
      tableId: T.audit,
      rowId: ID.unique(),
      data: {
        gymId: a.gymId ?? null,
        actorId: a.actor.$id,
        actorName: a.actor.name || a.actor.email || "System",
        action: a.action,
        entity: a.entity ?? null,
        entityId: a.entityId ?? null,
        summary: a.summary?.slice(0, 2000) ?? null,
        ip: await clientIp().catch(() => ""),
        at: new Date().toISOString(),
      },
      permissions: a.gymId ? rowPermissions(T.audit, a.gymId) : [],
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
