import "server-only";
import { addDays, subDays } from "date-fns";
import { Query, type Models } from "node-appwrite";
import { T } from "@/lib/appwrite/schema";
import { repo } from "@/lib/data/repo";
import { dayKey } from "@/lib/domain/membership";
import type { Automation, Checkin, Expense, Invoice, Lead, Member, Membership, Message, Payment, Plan } from "@/lib/types";

type Stat = Models.Row & { day: string; checkins: number; revenue: number; payments: number; newMembers: number; sales: number; leads: number };

const TZ = "Asia/Kolkata";
const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(d);
const monthLabel = (d: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, month: "short" }).format(d);
const dayLabel = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(d);

export async function dashboardData(gymId: string) {
  const r = repo(gymId);
  const now = new Date();
  const iso = now.toISOString();
  const since = dayKey(subDays(now, 400));

  const [stats, activeCount, totalMembers, expiring, dues, idle, recentPayments, today, openLeads, queued] = await Promise.all([
    r.all<Stat>(T.dailyStats, [Query.greaterThanEqual("day", since)], 500),
    r.count(T.members, [Query.equal("status", "active"), Query.greaterThanEqual("expiresAt", iso)]),
    r.count(T.members),
    r.list<Member>(
      T.members,
      [Query.equal("status", "active"), Query.between("expiresAt", iso, addDays(now, 7).toISOString()), Query.orderAsc("expiresAt"), Query.limit(12)],
      true,
    ),
    r.list<Member>(T.members, [Query.greaterThan("balanceDue", 0), Query.orderDesc("balanceDue"), Query.limit(200)], true),
    r.list<Member>(
      T.members,
      [
        Query.equal("status", "active"),
        Query.greaterThanEqual("expiresAt", iso),
        Query.lessThan("lastVisitAt", subDays(now, 7).toISOString()),
        Query.orderAsc("lastVisitAt"),
        Query.limit(8),
      ],
      true,
    ),
    r.list<Payment>(T.payments, [Query.orderDesc("paidAt"), Query.limit(8)], false),
    r.list<Checkin>(T.checkins, [Query.equal("dayKey", dayKey(now)), Query.orderDesc("at"), Query.limit(40)], true),
    r.list<Lead>(T.leads, [Query.notEqual("status", "joined"), Query.notEqual("status", "lost"), Query.limit(500)], true),
    r.count(T.messages, [Query.equal("status", "queued")]),
  ]);

  const byDay = new Map(stats.map((s) => [s.day, s]));
  const statOn = (d: Date) => byDay.get(dayKey(d));

  // Monthly revenue (12 months)
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 15);
    return { key: monthKey(d), label: monthLabel(d), revenue: 0, checkins: 0, newMembers: 0 };
  });
  for (const s of stats) {
    const m = months.find((x) => x.key === s.day.slice(0, 7));
    if (m) {
      m.revenue += s.revenue ?? 0;
      m.checkins += s.checkins ?? 0;
      m.newMembers += s.newMembers ?? 0;
    }
  }

  const series = (days: number, fmt: Intl.DateTimeFormatOptions) =>
    Array.from({ length: days }, (_, k) => {
      const d = subDays(now, days - 1 - k);
      const prev = subDays(d, days);
      return { label: dayLabel(d, fmt), value: statOn(d)?.checkins ?? 0, compare: statOn(prev)?.checkins ?? 0 };
    });

  // 12-week heatmap: rows = weekday (Mon..Sun), cols = weeks
  const weeks = 12;
  const startMonday = subDays(now, ((now.getDay() + 6) % 7) + (weeks - 1) * 7);
  const heat: { key: string; value: number; label: string }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    for (let w = 0; w < weeks; w++) {
      const d = addDays(startMonday, w * 7 + wd);
      const future = d > now;
      heat.push({
        key: `${w}-${wd}`,
        value: future ? 0 : (statOn(d)?.checkins ?? 0),
        label: dayLabel(d, { weekday: "short", day: "2-digit", month: "short" }),
      });
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sumRange = (from: Date, to: Date, k: keyof Stat) =>
    stats.filter((s) => s.day >= dayKey(from) && s.day < dayKey(to)).reduce((a, s) => a + ((s[k] as number) ?? 0), 0);
  const dayOfMonth = now.getDate();
  const lastMonthSameDay = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth + 1);

  return {
    kpis: {
      activeMembers: activeCount,
      totalMembers,
      collectedThisMonth: sumRange(monthStart, addDays(now, 1), "revenue"),
      collectedLastMonthToDate: sumRange(lastMonthStart, lastMonthSameDay, "revenue"),
      newThisMonth: sumRange(monthStart, addDays(now, 1), "newMembers"),
      newLastMonthToDate: sumRange(lastMonthStart, lastMonthSameDay, "newMembers"),
      duesTotal: dues.rows.reduce((s, m) => s + m.balanceDue, 0),
      duesCount: dues.total,
      expiringCount: expiring.total,
      checkinsToday: today.total,
      checkinsYesterday: statOn(subDays(now, 1))?.checkins ?? 0,
      openLeads: openLeads.total,
      queuedMessages: queued,
    },
    months,
    checkins: {
      weekly: series(7, { weekday: "short" }),
      monthly: series(30, { day: "2-digit", month: "short" }),
      yearly: months.map((m) => ({ label: m.label, value: m.checkins })),
    },
    heatmap: heat,
    expiring: expiring.rows,
    dues: dues.rows.slice(0, 8),
    idle: idle.rows,
    recentPayments: recentPayments.rows,
    today: today.rows,
    leadsByStatus: ["new", "contacted", "trial_booked", "trial_done"].map((s) => ({ status: s, count: openLeads.rows.filter((l) => l.status === s).length })),
  };
}

export async function listMembers(gymId: string) {
  return repo(gymId).all<Member>(T.members, [Query.orderDesc("$createdAt")]);
}

export async function listPlans(gymId: string, includeArchived = false) {
  return repo(gymId).all<Plan>(T.plans, [...(includeArchived ? [] : [Query.equal("active", true)]), Query.orderAsc("sortOrder")]);
}

export async function memberProfile(gymId: string, memberId: string, opts: { billing: boolean; messages: boolean } = { billing: true, messages: true }) {
  const r = repo(gymId);
  const member = await r.get<Member>(T.members, memberId);
  const none = { rows: [] as never[] };
  const [memberships, invoices, payments, checkins, messages] = await Promise.all([
    r.list<Membership>(T.memberships, [Query.equal("memberId", memberId), Query.orderDesc("startAt"), Query.limit(50)], false),
    opts.billing
      ? r.list<Invoice>(T.invoices, [Query.equal("memberId", memberId), Query.orderDesc("issuedAt"), Query.limit(50)], false)
      : Promise.resolve(none),
    opts.billing ? r.list<Payment>(T.payments, [Query.equal("memberId", memberId), Query.orderDesc("paidAt"), Query.limit(50)], false) : Promise.resolve(none),
    r.list<Checkin>(
      T.checkins,
      [Query.equal("memberId", memberId), Query.greaterThanEqual("at", subDays(new Date(), 119).toISOString()), Query.orderDesc("at"), Query.limit(500)],
      true,
    ),
    opts.messages
      ? r.list<Message>(T.messages, [Query.equal("memberId", memberId), Query.orderDesc("$createdAt"), Query.limit(30)], false)
      : Promise.resolve(none),
  ]);
  return { member, memberships: memberships.rows, invoices: invoices.rows, payments: payments.rows, checkins: checkins.rows, messages: messages.rows };
}

export async function billingData(gymId: string) {
  const r = repo(gymId);
  const [invoices, payments] = await Promise.all([
    r.all<Invoice>(T.invoices, [Query.orderDesc("issuedAt")], 3000),
    r.all<Payment>(T.payments, [Query.orderDesc("paidAt")], 3000),
  ]);
  return { invoices, payments };
}

export async function listLeads(gymId: string) {
  return repo(gymId).all<Lead>(T.leads, [Query.orderDesc("$createdAt")], 3000);
}

export async function automationsData(gymId: string) {
  const r = repo(gymId);
  const [automations, messages, counts] = await Promise.all([
    r.all<Automation>(T.automations),
    r.list<Message>(T.messages, [Query.orderDesc("$createdAt"), Query.limit(200)], true),
    Promise.all(["queued", "sent", "failed", "manual", "skipped"].map((s) => r.count(T.messages, [Query.equal("status", s)]).then((c) => [s, c] as const))),
  ]);
  return { automations, messages: messages.rows, counts: Object.fromEntries(counts) as Record<string, number> };
}

export async function financeData(gymId: string) {
  const r = repo(gymId);
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [expenses, stats] = await Promise.all([
    r.all<Expense>(T.expenses, [Query.greaterThanEqual("spentAt", since.toISOString()), Query.orderDesc("spentAt")], 3000),
    r.all<Stat>(T.dailyStats, [Query.greaterThanEqual("day", dayKey(since))], 500),
  ]);
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 15);
    return { key: monthKey(d), label: monthLabel(d), income: 0, expenses: 0 };
  });
  for (const s of stats) {
    const m = months.find((x) => x.key === s.day.slice(0, 7));
    if (m) m.income += s.revenue ?? 0;
  }
  for (const e of expenses) {
    const m = months.find((x) => x.key === monthKey(new Date(e.spentAt)));
    if (m) m.expenses += e.amount;
  }
  return { expenses, months };
}

export async function searchPeople(gymId: string, q: string) {
  const r = repo(gymId);
  const term = q.trim().slice(0, 64);
  const digits = term.replace(/\D/g, "");
  const queries: Promise<{ rows: Member[] }>[] = [
    r.list<Member>(T.members, [Query.search("name", term), Query.limit(8)], false).catch(() => ({ rows: [] as Member[] })),
  ];
  if (digits.length >= 3)
    queries.push(r.list<Member>(T.members, [Query.contains("phone", digits), Query.limit(8)], false).catch(() => ({ rows: [] as Member[] })));
  if (/^m\d+$/i.test(term))
    queries.push(r.list<Member>(T.members, [Query.equal("code", term.toUpperCase()), Query.limit(2)], false).catch(() => ({ rows: [] as Member[] })));
  const seen = new Set<string>();
  return (await Promise.all(queries))
    .flatMap((x) => x.rows)
    .filter((m) => (seen.has(m.$id) ? false : (seen.add(m.$id), true)))
    .slice(0, 8);
}
