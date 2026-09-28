/**
 * Seeds a realistic demo gym ("Iron Paradise Fitness", Visakhapatnam).
 *   npm run seed:demo            → creates the gym + ~140 members of history
 *   npm run seed:demo -- --reset → deletes the previous demo gym first
 * Owner login is printed to .dev/demo-credentials (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { addDays, subDays, startOfDay } from "date-fns";
import { Client, ID, Query, TablesDB, Teams, Users, Proxy } from "node-appwrite";
import { DB_ID, T } from "../src/lib/appwrite/schema";
import { createGym } from "../src/lib/services/platform";
import { computeInvoice, paymentStatus, SAC_FITNESS } from "../src/lib/domain/gst";
import { rowPermissions } from "../src/lib/data/repo";

const SLUG = "ironparadise";
const OWNER = "owner+demo@avnix.in";
const c = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const tables = new TablesDB(c);
const log = (...a: unknown[]) => console.log("•", ...a);
/** IST wall-clock time on a given calendar day → absolute Date (machine-TZ independent). */
const istAt = (day: Date, hour: number, minute = 0) => {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(day);
  return new Date(Date.parse(`${ymd}T00:00:00+05:30`) + hour * 3600e3 + minute * 60e3);
};

let seed = 42;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const FIRST = [
  "Ravi",
  "Sai",
  "Kiran",
  "Srinivas",
  "Lakshmi",
  "Priya",
  "Anil",
  "Sunitha",
  "Vamsi",
  "Harika",
  "Naveen",
  "Divya",
  "Rajesh",
  "Swathi",
  "Mahesh",
  "Keerthi",
  "Pavan",
  "Sravani",
  "Venkat",
  "Bhavani",
  "Arjun",
  "Sneha",
  "Teja",
  "Madhavi",
  "Chaitanya",
  "Ramya",
  "Suresh",
  "Anusha",
  "Karthik",
  "Deepika",
  "Praveen",
  "Mounika",
  "Gopi",
  "Navya",
  "Rohit",
  "Sirisha",
  "Ajay",
  "Pooja",
  "Manoj",
  "Harsha",
];
const LAST = ["Kumar", "Reddy", "Naidu", "Rao", "Varma", "Chowdary", "Sharma", "Patnaik", "Raju", "Babu", "Prasad", "Murthy", "Devi", "Goud", "Setti"];
const GOALS = ["Weight loss", "Muscle gain", "General fitness", "Strength", "Sports", "Flexibility"];

async function bulk(tableId: string, gymId: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows
      .slice(i, i + 50)
      .map((r) => ({ $id: (r.$id as string) ?? ID.unique(), $permissions: rowPermissions(tableId as never, gymId), gymId, ...r }));
    try {
      await tables.createRows({ databaseId: DB_ID, tableId, rows: chunk });
    } catch (e) {
      // fall back to row-by-row so one bad row is reported precisely
      for (const row of chunk) {
        const { $id, $permissions, ...data } = row;
        try {
          await tables.createRow({ databaseId: DB_ID, tableId, rowId: $id, data, permissions: $permissions });
        } catch (e2) {
          console.error(`✖ ${tableId} row failed`, (e2 as Error).message, JSON.stringify(data).slice(0, 400));
          throw e2;
        }
      }
      if (!(e instanceof Error)) throw e;
    }
  }
}

async function wipe(gymId: string) {
  for (const t of [
    T.members,
    T.plans,
    T.memberships,
    T.invoices,
    T.payments,
    T.checkins,
    T.leads,
    T.expenses,
    T.automations,
    T.messages,
    T.audit,
    T.dailyStats,
    T.platformInvoices,
  ]) {
    for (;;) {
      const r = await tables.listRows({ databaseId: DB_ID, tableId: t, queries: [Query.equal("gymId", gymId), Query.limit(100), Query.select(["$id"])] });
      if (!r.rows.length) break;
      await Promise.all(r.rows.map((x) => tables.deleteRow({ databaseId: DB_ID, tableId: t, rowId: x.$id })));
    }
  }
  const gym = (await tables.getRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId }).catch(() => null)) as unknown as { subdomainRuleId?: string } | null;
  if (gym?.subdomainRuleId) await new Proxy(c).deleteRule({ ruleId: gym.subdomainRuleId }).catch(() => {});
  await tables.deleteRow({ databaseId: DB_ID, tableId: T.platformSubscriptions, rowId: gymId }).catch(() => {});
  await tables.deleteRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId }).catch(() => {});
  await new Teams(c).delete({ teamId: gymId }).catch(() => {});
}

async function main() {
  const existing = await tables.listRows({ databaseId: DB_ID, tableId: T.gyms, queries: [Query.equal("slug", SLUG)] });
  if (existing.rows[0]) {
    if (!process.argv.includes("--reset")) throw new Error(`Demo gym exists (${existing.rows[0].$id}). Re-run with --reset.`);
    await wipe(existing.rows[0].$id);
    log("previous demo gym removed");
  }

  const res = await createGym(
    {
      name: "Iron Paradise Fitness",
      slug: SLUG,
      city: "Visakhapatnam",
      address: "3rd floor, Sai Towers, MVP Colony Sector 6",
      phone: "+919876543210",
      gstin: "37ABCDE1234F1Z5",
      owner: { name: "Ravi Teja", email: OWNER, phone: "+919876543210" },
      subscription: {
        planName: "Growth",
        setupFee: 15000,
        setupFeeStatus: "paid",
        monthlyFee: 1999,
        billingMonths: 12,
        billingStartAt: subDays(new Date(), 200).toISOString(),
        gstRate: 18,
        autoSuspend: false,
        graceDays: 7,
      },
      twilio: {},
      emailOwner: false,
    },
    { $id: "seed" },
  );
  const gymId = res.gymId;
  log("gym created", gymId, res.siteUrl);

  // richer website content
  await tables.updateRow({
    databaseId: DB_ID,
    tableId: T.gyms,
    rowId: gymId,
    data: {
      brandColor: "#16a34a",
      site: JSON.stringify({
        tagline: "Vizag's friendliest strength & fitness club",
        about:
          "Iron Paradise is a 6,000 sq ft training floor in MVP Colony with imported strength equipment, a dedicated cardio deck, certified coaches and personalised diet plans. Whether you're starting out or chasing a PR, we'll get you there.",
        amenities: [
          "Certified trainers",
          "Imported strength equipment",
          "Cardio deck",
          "Personal training",
          "Diet plans",
          "Steam & lockers",
          "Ample parking",
          "Women-only batch",
        ],
        hours: [
          { days: "Mon – Sat", open: "05:00", close: "22:00" },
          { days: "Sunday", open: "06:00", close: "12:00" },
        ],
        trainers: [
          { name: "Kiran Varma", role: "Head coach · Strength" },
          { name: "Sravani Reddy", role: "Women's fitness & Zumba" },
          { name: "Arjun Naidu", role: "Personal training" },
        ],
        faqs: [
          { q: "Do you offer a free trial?", a: "Yes — book a free trial session online and a coach will show you around." },
          { q: "Is there a women-only batch?", a: "Yes, 7–9 AM every weekday with a female trainer." },
          { q: "Can I pause my membership?", a: "You can freeze your membership for travel or illness; your expiry date extends automatically." },
        ],
        showPrices: true,
      }),
    },
  });

  const plans = (await tables.listRows({ databaseId: DB_ID, tableId: T.plans, queries: [Query.equal("gymId", gymId)] })).rows as unknown as {
    $id: string;
    name: string;
    type: string;
    durationDays: number;
    price: number;
    sessions: number;
  }[];
  const durationPlans = plans.filter((p) => p.type === "duration");
  const now = new Date();

  const members: Record<string, unknown>[] = [];
  const memberships: Record<string, unknown>[] = [];
  const invoices: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const checkins: Record<string, unknown>[] = [];
  const stats = new Map<string, { checkins: number; revenue: number; payments: number; newMembers: number; sales: number; leads: number }>();
  const stat = (d: Date) => {
    const k = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    if (!stats.has(k)) stats.set(k, { checkins: 0, revenue: 0, payments: 0, newMembers: 0, sales: 0, leads: 0 });
    return stats.get(k)!;
  };
  let invSeq = 0;
  const N = 140;

  for (let i = 0; i < N; i++) {
    const id = ID.unique();
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const phone = `+91${pick(["9", "8", "7", "6"])}${String(int(100000000, 999999999))}`;
    const joined = subDays(now, int(3, 360));
    let cursor = startOfDay(joined);
    let expiresAt: Date | null = null;
    let lastMsId = "";
    let lastPlan = durationPlans[0];
    let balance = 0;
    const churny = rnd() < 0.28;

    // successive memberships until today (or churn)
    for (let k = 0; k < 8; k++) {
      const plan = rnd() < 0.55 ? durationPlans[0] : pick(durationPlans);
      const start = cursor;
      const end = addDays(start, plan.durationDays - 1);
      const msId = ID.unique();
      const invId = ID.unique();
      invSeq++;
      const totals = computeInvoice({
        items: [{ description: `${plan.name} membership`, qty: 1, rate: plan.price, amount: plan.price, sac: SAC_FITNESS }],
        discount: rnd() < 0.2 ? 200 : 0,
        rate: 5,
        inclusive: true,
      });
      const partial = start > subDays(now, 20) && rnd() < 0.18;
      const paid = partial ? Math.round(totals.total * 0.5) : totals.total;
      balance += totals.total - paid;
      memberships.push({
        $id: msId,
        memberId: id,
        planId: plan.$id,
        planName: plan.name,
        type: "duration",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        price: plan.price,
        discount: totals.discount,
        status: end < now ? "completed" : "active",
        invoiceId: invId,
        soldBy: "Ravi Teja",
        sessionsTotal: 0,
        sessionsUsed: 0,
        frozenDays: 0,
      });
      invoices.push({
        $id: invId,
        memberId: id,
        memberName: name,
        memberPhone: phone,
        membershipId: msId,
        number: `INV/${start.getMonth() >= 3 ? `${String(start.getFullYear()).slice(2)}-${String(start.getFullYear() + 1).slice(2)}` : `${String(start.getFullYear() - 1).slice(2)}-${String(start.getFullYear()).slice(2)}`}/${String(invSeq).padStart(4, "0")}`,
        issuedAt: start.toISOString(),
        items: JSON.stringify([{ description: `${plan.name} membership`, qty: 1, rate: plan.price, amount: plan.price, sac: SAC_FITNESS }]),
        ...totals,
        paid,
        balance: totals.total - paid,
        status: paymentStatus(totals.total, paid),
      });
      const payAt = addDays(start, int(0, 1));
      if (paid > 0) {
        payments.push({
          memberId: id,
          memberName: name,
          invoiceId: invId,
          invoiceNumber: invoices[invoices.length - 1].number,
          amount: paid,
          method: pick(["upi", "upi", "upi", "cash", "cash", "card"]),
          reference: null,
          paidAt: istAt(payAt, int(6, 20), int(0, 59)).toISOString(),
          recordedByName: "Front desk",
        });
        const s = stat(payAt);
        s.revenue += paid;
        s.payments++;
        s.sales++;
      }
      if (k === 0) stat(start).newMembers++;
      expiresAt = end;
      lastMsId = msId;
      lastPlan = plan;
      cursor = addDays(end, 1);
      if (cursor > now) break;
      if (churny && rnd() < 0.45) break; // lapsed
    }

    // attendance over the last 84 days while active
    const freq = churny ? rnd() * 0.25 : 0.35 + rnd() * 0.45;
    let lastVisit: Date | null = null;
    let visits = 0;
    const idleTail = rnd() < 0.12 ? int(8, 20) : 0;
    for (let dday = 84; dday >= idleTail; dday--) {
      const day = subDays(now, dday);
      if (day < joined || (expiresAt && day > expiresAt)) continue;
      if (day.getDay() === 0 && rnd() < 0.7) continue;
      if (rnd() < freq) {
        const at = istAt(day, rnd() < 0.62 ? int(5, 9) : int(16, 21), int(0, 59));
        if (at > now) continue;
        checkins.push({
          memberId: id,
          memberName: name,
          at: at.toISOString(),
          dayKey: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at),
          method: pick(["manual", "qr", "qr", "biometric"]),
          by: "Front desk",
        });
        stat(at).checkins++;
        lastVisit = at;
        visits++;
      }
    }

    members.push({
      $id: id,
      code: `M${String(i + 1).padStart(4, "0")}`,
      name,
      phone,
      email: rnd() < 0.5 ? `${name.split(" ")[0].toLowerCase()}${int(1, 99)}@gmail.com` : null,
      gender: rnd() < 0.62 ? "male" : "female",
      dob: rnd() < 0.7 ? new Date(int(1975, 2006), int(0, 11), int(1, 28)).toISOString() : null,
      lang: rnd() < 0.45 ? "te" : "en",
      goal: pick(GOALS),
      status: "active",
      planId: lastPlan.$id,
      planName: lastPlan.name,
      membershipId: lastMsId,
      startAt: joined.toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
      balanceDue: balance,
      lastVisitAt: lastVisit?.toISOString() ?? null,
      visitCount: visits + int(0, 40),
      source: pick(["walkin", "walkin", "referral", "instagram", "google", "website"]),
      whatsappOptIn: true,
      consentAt: joined.toISOString(),
      trainerName: rnd() < 0.3 ? pick(["Kiran Varma", "Sravani Reddy", "Arjun Naidu"]) : null,
    });
  }
  // members whose last plan ended are "expired"
  for (const m of members) if (m.expiresAt && new Date(m.expiresAt as string) < startOfDay(now)) m.status = "expired";

  await bulk(T.members, gymId, members);
  await bulk(T.memberships, gymId, memberships);
  await bulk(T.invoices, gymId, invoices);
  await bulk(T.payments, gymId, payments);
  await bulk(T.checkins, gymId, checkins);
  log(`members ${members.length}, memberships ${memberships.length}, invoices ${invoices.length}, payments ${payments.length}, check-ins ${checkins.length}`);

  // leads pipeline
  const leads: Record<string, unknown>[] = [];
  const statuses = ["new", "new", "contacted", "contacted", "trial_booked", "trial_done", "joined", "lost"];
  for (let i = 0; i < 26; i++) {
    const created = subDays(now, int(0, 40));
    const status = pick(statuses);
    leads.push({
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone: `+91${pick(["9", "8", "7"])}${int(100000000, 999999999)}`,
      source: pick(["website", "instagram", "walkin", "whatsapp", "google", "referral"]),
      goal: pick(GOALS),
      status,
      trialAt: status === "trial_booked" ? addDays(now, int(0, 3)).toISOString() : null,
      followUpAt: status === "contacted" ? addDays(now, int(0, 4)).toISOString() : null,
      notes: rnd() < 0.4 ? "Asked about the women-only batch." : null,
      lostReason: status === "lost" ? pick(["Too far", "Price", "Joined another gym"]) : null,
    });
    stat(created).leads++;
  }
  await bulk(T.leads, gymId, leads);

  // expenses
  const expenses: Record<string, unknown>[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 5);
    if (d > now) continue;
    expenses.push({ category: "rent", amount: 55000, spentAt: d.toISOString(), vendor: "Sai Towers", note: "Monthly rent" });
    expenses.push({ category: "salary", amount: 92000, spentAt: addDays(d, 2).toISOString(), vendor: "Staff", note: "Trainers & front desk" });
    expenses.push({ category: "utilities", amount: int(14000, 21000), spentAt: addDays(d, 8).toISOString(), vendor: "APEPDCL", note: "Electricity" });
    if (rnd() < 0.5)
      expenses.push({
        category: "maintenance",
        amount: int(3000, 12000),
        spentAt: addDays(d, 14).toISOString(),
        vendor: "FitServ",
        note: "Treadmill servicing",
      });
    if (rnd() < 0.4)
      expenses.push({ category: "marketing", amount: int(4000, 15000), spentAt: addDays(d, 18).toISOString(), vendor: "Instagram ads", note: null });
  }
  await bulk(T.expenses, gymId, expenses);

  // daily rollups
  const statRows = [...stats.entries()].map(([day, s]) => ({ $id: `${gymId}_${day.replace(/-/g, "")}`, day, ...s }));
  await bulk(T.dailyStats, gymId, statRows);
  await tables.updateRow({ databaseId: DB_ID, tableId: T.gyms, rowId: gymId, data: { memberSeq: N, invoiceSeq: invSeq } });
  log(`leads ${leads.length}, expenses ${expenses.length}, stat days ${statRows.length}`);

  mkdirSync(".dev", { recursive: true });
  if (res.credentials.password)
    writeFileSync(
      ".dev/demo-credentials",
      `Demo gym: ${res.siteUrl}\nLogin: ${res.loginUrl}\nEmail: ${OWNER}\nPassword: ${res.credentials.password ?? "(existing account)"}\n`,
      { mode: 0o600 },
    );
  log("owner credentials → .dev/demo-credentials");
  void Users;
}

main().catch((e) => {
  console.error("✖", e?.message || e);
  process.exit(1);
});
