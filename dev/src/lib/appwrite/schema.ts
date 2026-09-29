/**
 * Single source of truth for the Appwrite TablesDB schema.
 * Consumed by `scripts/appwrite-setup.ts` (idempotent provisioning) and by
 * the data layer for table ids. Keep column keys ≤ 32 chars.
 */

export const DB_ID = process.env.APPWRITE_DATABASE_ID || "gymos";

export const T = {
  gyms: "gyms",
  members: "members",
  plans: "plans",
  memberships: "memberships",
  invoices: "invoices",
  payments: "payments",
  checkins: "checkins",
  leads: "leads",
  expenses: "expenses",
  automations: "automations",
  messages: "messages",
  audit: "audit",
  platformSubscriptions: "platform_subscriptions",
  platformInvoices: "platform_invoices",
  rateLimits: "rate_limits",
  dailyStats: "daily_stats",
  devices: "devices",
  punches: "punches",
  faceProfiles: "face_profiles",
  platformSettings: "platform_settings",
} as const;
export type TableId = (typeof T)[keyof typeof T];

export const BUCKETS = {
  gymMedia: "gym-media",
  memberPhotos: "member-photos",
} as const;

type Col =
  | { key: string; type: "varchar"; size: number; required?: boolean; default?: string; array?: boolean }
  | { key: string; type: "text" | "mediumtext" | "longtext"; required?: boolean; default?: string }
  | { key: string; type: "integer"; required?: boolean; default?: number; min?: number; max?: number }
  | { key: string; type: "double"; required?: boolean; default?: number; min?: number; max?: number }
  | { key: string; type: "boolean"; required?: boolean; default?: boolean }
  | { key: string; type: "datetime"; required?: boolean }
  | { key: string; type: "enum"; elements: readonly string[]; required?: boolean; default?: string };

type Idx = { key: string; type: "key" | "unique" | "fulltext"; attributes: string[]; orders?: ("ASC" | "DESC")[] };

export type TableDef = {
  id: TableId;
  name: string;
  /** "team" → rows readable by the gym team (realtime); "private" → server only */
  access: "team" | "team-admin" | "private";
  columns: Col[];
  indexes: Idx[];
};

// ── enums (exported for zod + UI) ──────────────────────────────────────────
export const GYM_STATUS = ["active", "suspended", "archived"] as const;
export const DOMAIN_STATUS = ["none", "pending", "verified", "failed"] as const;
export const MEMBER_STATUS = ["none", "active", "frozen", "expired", "cancelled"] as const;
export const GENDER = ["male", "female", "other", "unspecified"] as const;
export const LANGS = ["en", "te", "hi"] as const;
export const PLAN_TYPES = ["duration", "sessions", "pt"] as const;
export const MEMBERSHIP_STATUS = ["active", "upcoming", "frozen", "completed", "cancelled"] as const;
export const INVOICE_STATUS = ["paid", "partial", "unpaid", "void"] as const;
export const PAY_METHODS = ["cash", "upi", "card", "bank", "other"] as const;
export const CHECKIN_METHODS = ["manual", "qr", "biometric", "kiosk", "fingerprint", "face", "card"] as const;
export const DEVICE_VENDORS = ["zkteco", "hikvision", "generic", "kiosk"] as const;
export const PUNCH_RESULTS = ["checked_in", "duplicate", "blocked", "unknown", "ignored"] as const;
export const LEAD_SOURCES = ["walkin", "whatsapp", "instagram", "facebook", "google", "referral", "website", "other"] as const;
export const LEAD_STATUS = ["new", "contacted", "trial_booked", "trial_done", "joined", "lost"] as const;
export const EXPENSE_CATS = ["rent", "salary", "utilities", "equipment", "maintenance", "marketing", "supplements", "software", "other"] as const;
export const CHANNELS = ["whatsapp", "sms", "email"] as const;
export const MSG_STATUS = ["queued", "sending", "sent", "delivered", "read", "failed", "skipped", "manual"] as const;
export const STAFF_ROLES = ["owner", "manager", "frontdesk", "trainer"] as const;
export const SUB_STATUS = ["trial", "active", "paused", "cancelled", "completed"] as const;
export const FEE_STATUS = ["due", "paid", "waived"] as const;
export const PINV_KIND = ["setup", "monthly", "other"] as const;
export const PINV_STATUS = ["due", "paid", "overdue", "waived", "void"] as const;

const gymId: Col = { key: "gymId", type: "varchar", size: 36, required: true };
const id36 = (key: string, required = false): Col => ({ key, type: "varchar", size: 36, required });
const name128 = (key = "name", required = true): Col => ({ key, type: "varchar", size: 128, required });
const phone = (key = "phone", required = false): Col => ({ key, type: "varchar", size: 20, required });
const money = (key: string, def = 0): Col => ({ key, type: "double", default: def });
const dt = (key: string, required = false): Col => ({ key, type: "datetime", required });

export const TABLES: TableDef[] = [
  {
    id: T.gyms,
    name: "Gyms",
    access: "team",
    columns: [
      name128(),
      { key: "slug", type: "varchar", size: 63, required: true },
      { key: "city", type: "varchar", size: 64 },
      { key: "address", type: "text" },
      phone(),
      { key: "email", type: "varchar", size: 128 },
      { key: "gstin", type: "varchar", size: 20 },
      { key: "stateCode", type: "varchar", size: 4, default: "37" },
      { key: "gstRate", type: "double", default: 5 },
      { key: "gstInclusive", type: "boolean", default: true },
      { key: "logoFileId", type: "varchar", size: 64 },
      { key: "brandColor", type: "varchar", size: 16, default: "#16a34a" },
      { key: "status", type: "enum", elements: GYM_STATUS, default: "active" },
      { key: "siteEnabled", type: "boolean", default: true },
      { key: "subdomainRuleId", type: "varchar", size: 64 },
      { key: "customDomainEnabled", type: "boolean", default: false },
      { key: "customDomain", type: "varchar", size: 253 },
      { key: "customDomainStatus", type: "enum", elements: DOMAIN_STATUS, default: "none" },
      { key: "customDomainRuleId", type: "varchar", size: 64 },
      id36("ownerUserId"),
      name128("ownerName", false),
      { key: "ownerEmail", type: "varchar", size: 128 },
      phone("ownerPhone"),
      { key: "twilioSmsServiceSid", type: "varchar", size: 64 },
      { key: "twilioWhatsappFrom", type: "varchar", size: 32 },
      { key: "twilioWhatsappServiceSid", type: "varchar", size: 64 },
      { key: "messagingEnabled", type: "boolean", default: false },
      { key: "autoSend", type: "boolean", default: false },
      { key: "site", type: "longtext" },
      { key: "settings", type: "text" },
      { key: "memberSeq", type: "integer", default: 0 },
      { key: "invoiceSeq", type: "integer", default: 0 },
      dt("journeysRunAt"),
    ],
    indexes: [
      { key: "slug_unique", type: "unique", attributes: ["slug"] },
      { key: "domain_idx", type: "key", attributes: ["customDomain"] },
      { key: "status_idx", type: "key", attributes: ["status"] },
      { key: "name_ft", type: "fulltext", attributes: ["name"] },
    ],
  },
  {
    id: T.members,
    name: "Members",
    access: "team",
    columns: [
      gymId,
      { key: "code", type: "varchar", size: 16 },
      name128(),
      phone("phone", true),
      { key: "email", type: "varchar", size: 128 },
      { key: "gender", type: "enum", elements: GENDER, default: "unspecified" },
      dt("dob"),
      { key: "lang", type: "enum", elements: LANGS, default: "en" }, // note: a column named "language" 500s on Appwrite 2.0
      { key: "goal", type: "varchar", size: 64 },
      { key: "address", type: "text" },
      name128("emergencyName", false),
      phone("emergencyPhone"),
      { key: "notes", type: "text" },
      { key: "photoFileId", type: "varchar", size: 64 },
      { key: "status", type: "enum", elements: MEMBER_STATUS, default: "none" },
      id36("planId"),
      name128("planName", false),
      id36("membershipId"),
      dt("startAt"),
      dt("expiresAt"),
      money("balanceDue"),
      dt("lastVisitAt"),
      { key: "visitCount", type: "integer", default: 0 },
      id36("trainerId"),
      name128("trainerName", false),
      { key: "source", type: "enum", elements: LEAD_SOURCES, default: "walkin" },
      { key: "whatsappOptIn", type: "boolean", default: true },
      dt("consentAt"),
    ],
    indexes: [
      { key: "gym_status", type: "key", attributes: ["gymId", "status"] },
      { key: "gym_expires", type: "key", attributes: ["gymId", "expiresAt"] },
      { key: "gym_phone", type: "key", attributes: ["gymId", "phone"] },
      { key: "gym_code", type: "key", attributes: ["gymId", "code"] },
      { key: "gym_lastvisit", type: "key", attributes: ["gymId", "lastVisitAt"] },
      { key: "gym_balance", type: "key", attributes: ["gymId", "balanceDue"] },
      { key: "name_ft", type: "fulltext", attributes: ["name"] },
    ],
  },
  {
    id: T.plans,
    name: "Plans",
    access: "team",
    columns: [
      gymId,
      name128(),
      { key: "type", type: "enum", elements: PLAN_TYPES, default: "duration" },
      { key: "durationDays", type: "integer", default: 30 },
      { key: "sessions", type: "integer", default: 0 },
      money("price"),
      money("joiningFee"),
      { key: "description", type: "text" },
      { key: "color", type: "varchar", size: 16, default: "#16a34a" },
      { key: "active", type: "boolean", default: true },
      { key: "featured", type: "boolean", default: false },
      { key: "sortOrder", type: "integer", default: 0 },
    ],
    indexes: [{ key: "gym_active", type: "key", attributes: ["gymId", "active"] }],
  },
  {
    id: T.memberships,
    name: "Memberships",
    access: "team",
    columns: [
      gymId,
      id36("memberId", true),
      id36("planId"),
      name128("planName"),
      { key: "type", type: "enum", elements: PLAN_TYPES, default: "duration" },
      dt("startAt", true),
      dt("endAt", true),
      money("price"),
      money("discount"),
      { key: "status", type: "enum", elements: MEMBERSHIP_STATUS, default: "active" },
      dt("freezeFrom"),
      dt("freezeUntil"),
      { key: "frozenDays", type: "integer", default: 0 },
      { key: "sessionsTotal", type: "integer", default: 0 },
      { key: "sessionsUsed", type: "integer", default: 0 },
      id36("invoiceId"),
      name128("soldBy", false),
    ],
    indexes: [
      { key: "gym_member", type: "key", attributes: ["gymId", "memberId"] },
      { key: "gym_end", type: "key", attributes: ["gymId", "endAt"] },
    ],
  },
  {
    id: T.invoices,
    name: "Invoices",
    access: "team-admin",
    columns: [
      gymId,
      id36("memberId", true),
      name128("memberName"),
      phone("memberPhone"),
      id36("membershipId"),
      { key: "number", type: "varchar", size: 32, required: true },
      dt("issuedAt", true),
      { key: "items", type: "text" },
      money("subtotal"),
      money("discount"),
      money("taxable"),
      { key: "taxRate", type: "double", default: 5 },
      money("cgst"),
      money("sgst"),
      money("igst"),
      money("total"),
      money("paid"),
      money("balance"),
      { key: "status", type: "enum", elements: INVOICE_STATUS, default: "unpaid" },
      { key: "notes", type: "text" },
    ],
    indexes: [
      { key: "gym_issued", type: "key", attributes: ["gymId", "issuedAt"] },
      { key: "gym_status", type: "key", attributes: ["gymId", "status"] },
      { key: "gym_member", type: "key", attributes: ["gymId", "memberId"] },
      { key: "gym_number", type: "unique", attributes: ["gymId", "number"] },
    ],
  },
  {
    id: T.payments,
    name: "Payments",
    access: "team-admin",
    columns: [
      gymId,
      id36("memberId", true),
      name128("memberName"),
      id36("invoiceId"),
      { key: "invoiceNumber", type: "varchar", size: 32 },
      { key: "amount", type: "double", required: true },
      { key: "method", type: "enum", elements: PAY_METHODS, default: "cash" },
      { key: "reference", type: "varchar", size: 64 },
      dt("paidAt", true),
      { key: "note", type: "text" },
      id36("recordedBy"),
      name128("recordedByName", false),
    ],
    indexes: [
      { key: "gym_paid", type: "key", attributes: ["gymId", "paidAt"] },
      { key: "gym_member", type: "key", attributes: ["gymId", "memberId"] },
    ],
  },
  {
    id: T.checkins,
    name: "Check-ins",
    access: "team",
    columns: [
      gymId,
      id36("memberId", true),
      name128("memberName"),
      dt("at", true),
      { key: "dayKey", type: "varchar", size: 10, required: true },
      { key: "method", type: "enum", elements: CHECKIN_METHODS, default: "manual" },
      name128("by", false),
    ],
    indexes: [
      { key: "gym_at", type: "key", attributes: ["gymId", "at"] },
      { key: "gym_member_at", type: "key", attributes: ["gymId", "memberId", "at"] },
      { key: "gym_day", type: "key", attributes: ["gymId", "dayKey"] },
    ],
  },
  {
    id: T.leads,
    name: "Leads",
    access: "team",
    columns: [
      gymId,
      name128(),
      phone("phone", true),
      { key: "email", type: "varchar", size: 128 },
      { key: "source", type: "enum", elements: LEAD_SOURCES, default: "walkin" },
      { key: "goal", type: "varchar", size: 64 },
      { key: "status", type: "enum", elements: LEAD_STATUS, default: "new" },
      dt("trialAt"),
      dt("followUpAt"),
      { key: "notes", type: "text" },
      { key: "lostReason", type: "varchar", size: 128 },
      id36("assignedTo"),
      name128("assignedName", false),
      id36("memberId"),
    ],
    indexes: [
      { key: "gym_status", type: "key", attributes: ["gymId", "status"] },
      { key: "gym_followup", type: "key", attributes: ["gymId", "followUpAt"] },
      { key: "gym_phone", type: "key", attributes: ["gymId", "phone"] },
      { key: "name_ft", type: "fulltext", attributes: ["name"] },
    ],
  },
  {
    id: T.expenses,
    name: "Expenses",
    access: "team-admin",
    columns: [
      gymId,
      { key: "category", type: "enum", elements: EXPENSE_CATS, default: "other" },
      { key: "amount", type: "double", required: true },
      dt("spentAt", true),
      { key: "vendor", type: "varchar", size: 128 },
      { key: "note", type: "text" },
      name128("recordedByName", false),
    ],
    indexes: [{ key: "gym_spent", type: "key", attributes: ["gymId", "spentAt"] }],
  },
  {
    id: T.automations,
    name: "Automations",
    access: "team-admin",
    columns: [
      gymId,
      { key: "key", type: "varchar", size: 48, required: true },
      { key: "enabled", type: "boolean", default: false },
      { key: "channel", type: "enum", elements: CHANNELS, default: "whatsapp" },
      { key: "templateEn", type: "text" },
      { key: "templateTe", type: "text" },
      { key: "config", type: "text" },
    ],
    indexes: [{ key: "gym_key", type: "unique", attributes: ["gymId", "key"] }],
  },
  {
    id: T.messages,
    name: "Messages",
    access: "team",
    columns: [
      gymId,
      id36("memberId"),
      id36("leadId"),
      name128(),
      phone("phone"),
      { key: "playbook", type: "varchar", size: 48, required: true },
      { key: "channel", type: "enum", elements: CHANNELS, default: "whatsapp" },
      { key: "body", type: "text", required: true },
      { key: "status", type: "enum", elements: MSG_STATUS, default: "queued" },
      dt("dueAt"),
      dt("sentAt"),
      { key: "providerId", type: "varchar", size: 64 },
      { key: "error", type: "text" },
      { key: "dedupeKey", type: "varchar", size: 64, required: true },
      name128("by", false),
    ],
    indexes: [
      { key: "gym_status_due", type: "key", attributes: ["gymId", "status", "dueAt"] },
      { key: "gym_dedupe", type: "unique", attributes: ["gymId", "dedupeKey"] },
      { key: "gym_member", type: "key", attributes: ["gymId", "memberId"] },
      { key: "provider_idx", type: "key", attributes: ["providerId"] },
    ],
  },
  {
    id: T.audit,
    name: "Audit log",
    access: "team-admin",
    columns: [
      { key: "gymId", type: "varchar", size: 36 },
      id36("actorId"),
      name128("actorName", false),
      { key: "action", type: "varchar", size: 64, required: true },
      { key: "entity", type: "varchar", size: 32 },
      id36("entityId"),
      { key: "summary", type: "text" },
      { key: "ip", type: "varchar", size: 45 },
      dt("at", true),
    ],
    indexes: [{ key: "gym_at", type: "key", attributes: ["gymId", "at"] }],
  },
  {
    id: T.platformSubscriptions,
    name: "Platform subscriptions",
    access: "private",
    columns: [
      gymId,
      { key: "planName", type: "varchar", size: 64, default: "Growth" },
      money("setupFee"),
      { key: "setupFeeStatus", type: "enum", elements: FEE_STATUS, default: "due" },
      money("monthlyFee"),
      { key: "billingMonths", type: "integer", default: 12 },
      dt("billingStartAt"),
      dt("nextBillingAt"),
      { key: "status", type: "enum", elements: SUB_STATUS, default: "active" },
      { key: "graceDays", type: "integer", default: 7 },
      { key: "autoSuspend", type: "boolean", default: false },
      { key: "gstRate", type: "double", default: 18 },
      { key: "notes", type: "text" },
    ],
    indexes: [
      { key: "gym_unique", type: "unique", attributes: ["gymId"] },
      { key: "next_billing", type: "key", attributes: ["status", "nextBillingAt"] },
    ],
  },
  {
    id: T.platformInvoices,
    name: "Platform invoices",
    access: "private",
    columns: [
      gymId,
      name128("gymName"),
      { key: "number", type: "varchar", size: 32, required: true },
      { key: "kind", type: "enum", elements: PINV_KIND, default: "monthly" },
      { key: "sequence", type: "integer", default: 0 },
      dt("periodStart"),
      dt("periodEnd"),
      { key: "description", type: "varchar", size: 256 },
      money("amount"),
      { key: "gstRate", type: "double", default: 18 },
      money("tax"),
      money("total"),
      { key: "status", type: "enum", elements: PINV_STATUS, default: "due" },
      dt("dueAt"),
      dt("paidAt"),
      { key: "method", type: "varchar", size: 32 },
      { key: "reference", type: "varchar", size: 64 },
    ],
    indexes: [
      { key: "gym_due", type: "key", attributes: ["gymId", "dueAt"] },
      { key: "status_due", type: "key", attributes: ["status", "dueAt"] },
      { key: "number_unique", type: "unique", attributes: ["number"] },
    ],
  },
  {
    id: T.dailyStats,
    name: "Daily stats (rollups)",
    access: "team-admin",
    columns: [
      gymId,
      { key: "day", type: "varchar", size: 10, required: true },
      { key: "checkins", type: "integer", default: 0 },
      { key: "revenue", type: "double", default: 0 },
      { key: "payments", type: "integer", default: 0 },
      { key: "newMembers", type: "integer", default: 0 },
      { key: "sales", type: "integer", default: 0 },
      { key: "leads", type: "integer", default: 0 },
    ],
    indexes: [{ key: "gym_day", type: "unique", attributes: ["gymId", "day"] }],
  },
  {
    id: T.devices,
    name: "Attendance devices",
    // private: holds the device token hash; only the server reads it
    access: "private",
    columns: [
      gymId,
      name128(),
      { key: "vendor", type: "enum", elements: DEVICE_VENDORS, default: "generic" },
      { key: "serial", type: "varchar", size: 64 },
      { key: "tokenHash", type: "varchar", size: 64 },
      { key: "enabled", type: "boolean", default: true },
      dt("lastSeenAt"),
      { key: "lastIp", type: "varchar", size: 64 },
      dt("lastPunchAt"),
      { key: "punchCount", type: "integer", default: 0 },
      { key: "info", type: "text" },
    ],
    indexes: [
      { key: "gym", type: "key", attributes: ["gymId"] },
      { key: "serial", type: "key", attributes: ["serial"] },
      { key: "token", type: "key", attributes: ["tokenHash"] },
    ],
  },
  {
    id: T.punches,
    name: "Device punches",
    access: "team",
    columns: [
      gymId,
      id36("deviceId"),
      { key: "deviceName", type: "varchar", size: 128 },
      { key: "userId", type: "varchar", size: 32, required: true },
      dt("at", true),
      { key: "method", type: "enum", elements: CHECKIN_METHODS, default: "biometric" },
      { key: "result", type: "enum", elements: PUNCH_RESULTS, default: "checked_in" },
      id36("memberId"),
      name128("memberName", false),
      { key: "note", type: "varchar", size: 200 },
    ],
    indexes: [
      { key: "gym_at", type: "key", attributes: ["gymId", "at"] },
      { key: "gym_device_at", type: "key", attributes: ["gymId", "deviceId", "at"] },
    ],
  },
  {
    id: T.faceProfiles,
    name: "Face profiles (embeddings)",
    // private: biometric embeddings never leave the server
    access: "private",
    columns: [
      gymId,
      id36("memberId", true),
      name128("memberName", false),
      { key: "embeddings", type: "text", required: true },
      { key: "model", type: "varchar", size: 32 },
      // reference photo taken at enrolment (private member-photos bucket), for staff to verify
      { key: "photoFileId", type: "varchar", size: 64 },
      dt("consentAt", true),
      name128("consentBy", false),
    ],
    indexes: [{ key: "gym_member", type: "unique", attributes: ["gymId", "memberId"] }],
  },
  {
    id: T.platformSettings,
    name: "Platform settings",
    // super-admin configuration (row id = setting key, e.g. "pricing")
    access: "private",
    columns: [{ key: "value", type: "text", required: true }],
    indexes: [],
  },
  {
    id: T.rateLimits,
    name: "Rate limits",
    access: "private",
    columns: [
      { key: "count", type: "integer", default: 0 },
      { key: "windowStart", type: "double", default: 0 },
    ],
    indexes: [],
  },
];
