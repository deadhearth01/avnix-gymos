import "server-only";
import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import type { AuditEntry, Gym, PlatformInvoice, PlatformSubscription } from "@/lib/types";

async function listAll<R>(tableId: string, queries: string[] = [], cap = 5000): Promise<R[]> {
  const { tables } = adminClient();
  const out: R[] = [];
  let cursor: string | undefined;
  while (out.length < cap) {
    const page = await tables.listRows({
      databaseId: DB_ID,
      tableId,
      queries: [...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
      total: false,
    });
    out.push(...(page.rows as unknown as R[]));
    if (page.rows.length < 500) break;
    cursor = page.rows[page.rows.length - 1].$id;
  }
  return out;
}

export type GymListItem = Gym & { sub: PlatformSubscription | null; outstanding: number; members: number };

export async function listGyms(): Promise<GymListItem[]> {
  const [gyms, subs, invoices] = await Promise.all([
    listAll<Gym>(T.gyms, [Query.orderDesc("$createdAt")]),
    listAll<PlatformSubscription>(T.platformSubscriptions),
    listAll<PlatformInvoice>(T.platformInvoices, [Query.equal("status", ["due", "overdue"])]),
  ]);
  const { tables } = adminClient();
  const counts = await Promise.all(
    gyms.map((g) =>
      tables
        .listRows({ databaseId: DB_ID, tableId: T.members, queries: [Query.equal("gymId", g.$id), Query.limit(1), Query.select(["$id"])], total: true })
        .then((r) => r.total)
        .catch(() => 0),
    ),
  );
  return gyms.map((g, i) => ({
    ...g,
    sub: subs.find((s) => s.gymId === g.$id) ?? null,
    outstanding: invoices.filter((inv) => inv.gymId === g.$id).reduce((s, inv) => s + inv.total, 0),
    members: counts[i],
  }));
}

export async function adminOverview() {
  const [gyms, subs, invoices] = await Promise.all([
    listAll<Gym>(T.gyms),
    listAll<PlatformSubscription>(T.platformSubscriptions),
    listAll<PlatformInvoice>(T.platformInvoices, [Query.orderDesc("dueAt")]),
  ]);
  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trial");
  const mrr = activeSubs.reduce((s, x) => s + x.monthlyFee, 0);
  const outstanding = invoices.filter((i) => i.status === "due" || i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const overdue = invoices.filter((i) => i.status === "overdue");
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-IN", { month: "short" }).replace("Sept", "Sep"), billed: 0, collected: 0 };
  });
  for (const inv of invoices) {
    const due = inv.dueAt ? new Date(inv.dueAt) : null;
    if (due) {
      const m = months.find((x) => x.key === `${due.getFullYear()}-${due.getMonth()}`);
      if (m && inv.status !== "void" && inv.status !== "waived") m.billed += inv.total;
    }
    const paid = inv.paidAt ? new Date(inv.paidAt) : null;
    if (paid && inv.status === "paid") {
      const m = months.find((x) => x.key === `${paid.getFullYear()}-${paid.getMonth()}`);
      if (m) m.collected += inv.total;
    }
  }
  const thisMonth = months[11].collected;
  const lastMonth = months[10].collected;
  return {
    totalGyms: gyms.length,
    activeGyms: gyms.filter((g) => g.status === "active").length,
    suspendedGyms: gyms.filter((g) => g.status === "suspended").length,
    newThisMonth: gyms.filter((g) => new Date(g.$createdAt) >= new Date(now.getFullYear(), now.getMonth(), 1)).length,
    mrr,
    arr: mrr * 12,
    outstanding,
    overdueCount: overdue.length,
    collectedThisMonth: thisMonth,
    collectedLastMonth: lastMonth,
    months,
    recentGyms: [...gyms].sort((a, b) => b.$createdAt.localeCompare(a.$createdAt)).slice(0, 6),
    overdue: overdue.slice(0, 8),
    setupPending: subs.filter((s) => s.setupFee > 0 && s.setupFeeStatus === "due").length,
  };
}

export async function gymAdminDetail(gymId: string) {
  const { tables, teams, users, proxy } = adminClient();
  const gym = await tables.getRow<Gym>({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId });
  const [sub, invoices, memberships, stats] = await Promise.all([
    tables.getRow<PlatformSubscription>({ databaseId: DB_ID, tableId: T.platformSubscriptions, rowId: gymId }).catch(() => null),
    listAll<PlatformInvoice>(T.platformInvoices, [Query.equal("gymId", gymId), Query.orderAsc("dueAt")]),
    teams.listMemberships({ teamId: gymId, queries: [Query.limit(100)] }).catch(() => ({ memberships: [] as never[] })),
    Promise.all(
      [[Query.equal("gymId", gymId)], [Query.equal("gymId", gymId), Query.equal("status", "active")]].map((q) =>
        tables
          .listRows({ databaseId: DB_ID, tableId: T.members, queries: [...q, Query.limit(1), Query.select(["$id"])], total: true })
          .then((r) => r.total)
          .catch(() => 0),
      ),
    ),
  ]);
  const owner = gym.ownerUserId ? await users.get({ userId: gym.ownerUserId }).catch(() => null) : null;
  const subRule = gym.subdomainRuleId ? await proxy.getRule({ ruleId: gym.subdomainRuleId }).catch(() => null) : null;
  const customRule = gym.customDomainRuleId ? await proxy.getRule({ ruleId: gym.customDomainRuleId }).catch(() => null) : null;
  return {
    gym,
    sub,
    invoices,
    staff: memberships.memberships.map((m) => ({
      id: m.$id,
      userId: m.userId,
      name: m.userName,
      email: m.userEmail,
      roles: m.roles,
      joined: m.joined,
      confirm: m.confirm,
    })),
    members: { total: stats[0], active: stats[1] },
    owner: owner ? { name: owner.name, email: owner.email, lastSeen: owner.accessedAt, status: owner.status, mfa: owner.mfa } : null,
    subdomainRule: subRule ? { domain: subRule.domain, status: subRule.status, logs: subRule.logs } : null,
    customRule: customRule ? { domain: customRule.domain, status: customRule.status, logs: customRule.logs } : null,
  };
}

export async function listPlatformInvoices() {
  return listAll<PlatformInvoice>(T.platformInvoices, [Query.orderDesc("dueAt")]);
}

export async function listPlatformAudit(limit = 200) {
  const { tables } = adminClient();
  const r = await tables.listRows<AuditEntry>({ databaseId: DB_ID, tableId: T.audit, queries: [Query.orderDesc("at"), Query.limit(limit)] });
  return r.rows;
}
