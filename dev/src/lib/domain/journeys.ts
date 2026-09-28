/**
 * Journey engine — pure & deterministic. Given a gym's members/leads and its
 * automation settings, returns the messages that should exist right now.
 * Idempotency comes from `dedupeKey` (unique per gym in the messages table),
 * so the engine can run as often as we like.
 */
import { PLAYBOOK_BY_KEY, render, type AutomationConfig, type PlaybookKey } from "./playbooks";

export type EngineMember = {
  $id: string;
  name: string;
  phone: string;
  lang: "en" | "te" | "hi";
  status: string;
  planName: string | null;
  expiresAt: string | null;
  startAt: string | null;
  lastVisitAt: string | null;
  balanceDue: number;
  dob: string | null;
  whatsappOptIn: boolean;
};
export type EngineLead = { $id: string; name: string; phone: string; status: string; trialAt: string | null };
export type EngineAutomation = { key: string; enabled: boolean; templateEn: string | null; templateTe: string | null; config: string | null };
export type EngineGym = { $id: string; name: string; address: string | null; city: string | null };

export type Draft = {
  playbook: PlaybookKey;
  memberId?: string;
  leadId?: string;
  name: string;
  phone: string;
  body: string;
  dedupeKey: string;
};

const TZ = "Asia/Kolkata";
const DAY = 86_400_000;

/** Calendar day number in IST (for day arithmetic independent of server TZ). */
export function istDay(d: Date | string) {
  const t = typeof d === "string" ? new Date(d) : d;
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY);
}
const istYmd = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(typeof d === "string" ? new Date(d) : d);
const istMonthDay = (d: Date | string) => istYmd(d).slice(5);
const fmtDay = (d: string) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
const fmtTrial = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(d));
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function parseConfig(c: string | null): AutomationConfig {
  if (!c) return {};
  try {
    return JSON.parse(c) as AutomationConfig;
  } catch {
    return {};
  }
}

function hasValidPhone(p: string | null | undefined) {
  return !!p && p.replace(/\D/g, "").length >= 10;
}

export function planJourneys({
  gym,
  automations,
  members,
  leads,
  now = new Date(),
}: {
  gym: EngineGym;
  automations: EngineAutomation[];
  members: EngineMember[];
  leads: EngineLead[];
  now?: Date;
}): Draft[] {
  const on = new Map(automations.filter((a) => a.enabled).map((a) => [a.key, a]));
  const today = istDay(now);
  const drafts: Draft[] = [];

  const tpl = (key: PlaybookKey, lang: string) => {
    const a = on.get(key)!;
    const def = PLAYBOOK_BY_KEY[key];
    return (lang === "te" ? a.templateTe || def.te : a.templateEn || def.en) || def.en;
  };
  const offsets = (key: PlaybookKey) => {
    const cfg = parseConfig(on.get(key)?.config ?? null);
    return cfg.offsets?.length ? cfg.offsets : (PLAYBOOK_BY_KEY[key].defaultOffsets ?? []);
  };
  const push = (d: Omit<Draft, "dedupeKey"> & { key: string }) => {
    const { key, ...rest } = d;
    drafts.push({ ...rest, dedupeKey: key.slice(0, 64) });
  };

  for (const m of members) {
    if (!m.whatsappOptIn || !hasValidPhone(m.phone) || m.status === "cancelled") continue;
    const base = { name: m.name, gym: gym.name, plan: m.planName ?? "membership" };
    const expDay = m.expiresAt ? istDay(m.expiresAt) : null;
    const daysLeft = expDay === null ? null : expDay - today;
    const frozen = m.status === "frozen";

    if (on.has("renewal") && daysLeft !== null && daysLeft > 0 && !frozen && offsets("renewal").includes(daysLeft)) {
      push({
        key: `renewal:${m.$id}:${istYmd(m.expiresAt!)}:${daysLeft}`,
        playbook: "renewal",
        memberId: m.$id,
        name: m.name,
        phone: m.phone,
        body: render(tpl("renewal", m.lang), { ...base, days: daysLeft, expiry: fmtDay(m.expiresAt!) }),
      });
    }

    if (on.has("expiry_day") && daysLeft === 0 && !frozen) {
      push({
        key: `expiry:${m.$id}:${istYmd(m.expiresAt!)}`,
        playbook: "expiry_day",
        memberId: m.$id,
        name: m.name,
        phone: m.phone,
        body: render(tpl("expiry_day", m.lang), base),
      });
    }

    if (on.has("winback") && daysLeft !== null && daysLeft < 0 && offsets("winback").includes(-daysLeft)) {
      push({
        key: `winback:${m.$id}:${istYmd(m.expiresAt!)}:${-daysLeft}`,
        playbook: "winback",
        memberId: m.$id,
        name: m.name,
        phone: m.phone,
        body: render(tpl("winback", m.lang), base),
      });
    }

    if (on.has("dues") && m.balanceDue >= 1) {
      const every = Math.max(1, offsets("dues")[0] ?? 3);
      if (today % every === 0) {
        push({
          key: `dues:${m.$id}:${Math.round(m.balanceDue)}:${today}`,
          playbook: "dues",
          memberId: m.$id,
          name: m.name,
          phone: m.phone,
          body: render(tpl("dues", m.lang), { ...base, amount: inr(m.balanceDue) }),
        });
      }
    }

    const activeNow = daysLeft !== null && daysLeft >= 0 && !frozen;
    if (on.has("inactivity") && activeNow) {
      const anchor = m.lastVisitAt ?? m.startAt;
      if (anchor) {
        const idle = today - istDay(anchor);
        if (offsets("inactivity").includes(idle)) {
          push({
            key: `idle:${m.$id}:${istYmd(anchor)}:${idle}`,
            playbook: "inactivity",
            memberId: m.$id,
            name: m.name,
            phone: m.phone,
            body: render(tpl("inactivity", m.lang), { ...base, days: idle }),
          });
        }
      }
    }

    if (on.has("birthday") && m.dob && istMonthDay(m.dob) === istMonthDay(now)) {
      push({
        key: `bday:${m.$id}:${istYmd(now).slice(0, 4)}`,
        playbook: "birthday",
        memberId: m.$id,
        name: m.name,
        phone: m.phone,
        body: render(tpl("birthday", m.lang), base),
      });
    }
  }

  if (on.has("trial_reminder")) {
    for (const l of leads) {
      if (l.status !== "trial_booked" || !l.trialAt || !hasValidPhone(l.phone)) continue;
      const until = new Date(l.trialAt).getTime() - now.getTime();
      if (until > 0 && until <= 26 * 3_600_000) {
        push({
          key: `trial:${l.$id}:${l.trialAt}`,
          playbook: "trial_reminder",
          leadId: l.$id,
          name: l.name,
          phone: l.phone,
          body: render(tpl("trial_reminder", "en"), {
            name: l.name,
            gym: gym.name,
            trial: fmtTrial(l.trialAt),
            address: [gym.address, gym.city].filter(Boolean).join(", "),
          }),
        });
      }
    }
  }

  return drafts;
}

/** Quiet hours: only deliver between 09:00 and 20:30 IST. */
export function withinSendWindow(now = new Date()) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now).split(":").map(Number);
  const mins = h * 60 + m;
  return mins >= 9 * 60 && mins <= 20 * 60 + 30;
}
