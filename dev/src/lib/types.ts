import type { Models } from "node-appwrite";
import type {
  CHANNELS,
  CHECKIN_METHODS,
  DOMAIN_STATUS,
  EXPENSE_CATS,
  FEE_STATUS,
  GENDER,
  GYM_STATUS,
  INVOICE_STATUS,
  LANGS,
  LEAD_SOURCES,
  LEAD_STATUS,
  MEMBER_STATUS,
  MEMBERSHIP_STATUS,
  MSG_STATUS,
  PAY_METHODS,
  PINV_KIND,
  PINV_STATUS,
  PLAN_TYPES,
  STAFF_ROLES,
  SUB_STATUS,
} from "@/lib/appwrite/schema";

type E<T extends readonly string[]> = T[number];
type Row = Models.Row;

export type StaffRole = E<typeof STAFF_ROLES>;
export type MemberStatus = E<typeof MEMBER_STATUS>;
export type PlanType = E<typeof PLAN_TYPES>;
export type PayMethod = E<typeof PAY_METHODS>;
export type LeadStatus = E<typeof LEAD_STATUS>;
export type LeadSource = E<typeof LEAD_SOURCES>;
export type Lang = E<typeof LANGS>;
export type Channel = E<typeof CHANNELS>;
export type MsgStatus = E<typeof MSG_STATUS>;

export type GymSite = {
  /** Hero headline. */
  tagline?: string;
  /** Hero supporting line, shown under the headline. */
  heroText?: string;
  about?: string;
  heroFileId?: string;
  gallery?: string[];
  amenities?: string[];
  hours?: { days: string; open: string; close: string }[];
  socials?: { instagram?: string; facebook?: string; youtube?: string; google?: string };
  mapUrl?: string;
  faqs?: { q: string; a: string }[];
  trainers?: { name: string; role: string; photoFileId?: string; experience?: string; instagram?: string }[];
  showPrices?: boolean;
  /** Free-trial booking (buttons + form). Defaults to on. */
  showTrial?: boolean;
};

export type Gym = Row & {
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  stateCode: string | null;
  gstRate: number;
  gstInclusive: boolean;
  logoFileId: string | null;
  brandColor: string | null;
  status: E<typeof GYM_STATUS>;
  siteEnabled: boolean;
  subdomainRuleId: string | null;
  customDomainEnabled: boolean;
  customDomain: string | null;
  customDomainStatus: E<typeof DOMAIN_STATUS>;
  customDomainRuleId: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  twilioSmsServiceSid: string | null;
  twilioWhatsappFrom: string | null;
  twilioWhatsappServiceSid: string | null;
  messagingEnabled: boolean;
  autoSend: boolean;
  site: string | null;
  settings: string | null;
  memberSeq: number;
  invoiceSeq: number;
  journeysRunAt: string | null;
};

export type Member = Row & {
  gymId: string;
  code: string | null;
  name: string;
  phone: string;
  email: string | null;
  gender: E<typeof GENDER>;
  dob: string | null;
  lang: Lang;
  goal: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  notes: string | null;
  photoFileId: string | null;
  status: MemberStatus;
  planId: string | null;
  planName: string | null;
  membershipId: string | null;
  startAt: string | null;
  expiresAt: string | null;
  balanceDue: number;
  lastVisitAt: string | null;
  visitCount: number;
  trainerId: string | null;
  trainerName: string | null;
  source: LeadSource;
  whatsappOptIn: boolean;
  consentAt: string | null;
};

export type Plan = Row & {
  gymId: string;
  name: string;
  type: PlanType;
  durationDays: number;
  sessions: number;
  price: number;
  joiningFee: number;
  description: string | null;
  color: string | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
};

export type Membership = Row & {
  gymId: string;
  memberId: string;
  planId: string | null;
  planName: string;
  type: PlanType;
  startAt: string;
  endAt: string;
  price: number;
  discount: number;
  status: E<typeof MEMBERSHIP_STATUS>;
  freezeFrom: string | null;
  freezeUntil: string | null;
  frozenDays: number;
  sessionsTotal: number;
  sessionsUsed: number;
  invoiceId: string | null;
  soldBy: string | null;
};

export type InvoiceItem = { description: string; qty: number; rate: number; amount: number; sac?: string };

export type Invoice = Row & {
  gymId: string;
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  membershipId: string | null;
  number: string;
  issuedAt: string;
  items: string | null;
  subtotal: number;
  discount: number;
  taxable: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paid: number;
  balance: number;
  status: E<typeof INVOICE_STATUS>;
  notes: string | null;
};

export type Payment = Row & {
  gymId: string;
  memberId: string;
  memberName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  method: PayMethod;
  reference: string | null;
  paidAt: string;
  note: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
};

export type Checkin = Row & {
  gymId: string;
  memberId: string;
  memberName: string;
  at: string;
  dayKey: string;
  method: E<typeof CHECKIN_METHODS>;
  by: string | null;
};

export type Lead = Row & {
  gymId: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  goal: string | null;
  status: LeadStatus;
  trialAt: string | null;
  followUpAt: string | null;
  notes: string | null;
  lostReason: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  memberId: string | null;
};

export type Expense = Row & {
  gymId: string;
  category: E<typeof EXPENSE_CATS>;
  amount: number;
  spentAt: string;
  vendor: string | null;
  note: string | null;
  recordedByName: string | null;
};

export type Automation = Row & {
  gymId: string;
  key: string;
  enabled: boolean;
  channel: Channel;
  templateEn: string | null;
  templateTe: string | null;
  config: string | null;
};

export type Message = Row & {
  gymId: string;
  memberId: string | null;
  leadId: string | null;
  name: string;
  phone: string | null;
  playbook: string;
  channel: Channel;
  body: string;
  status: MsgStatus;
  dueAt: string | null;
  sentAt: string | null;
  providerId: string | null;
  error: string | null;
  dedupeKey: string;
  by: string | null;
};

export type AuditEntry = Row & {
  gymId: string | null;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  summary: string | null;
  ip: string | null;
  at: string;
};

export type PlatformSubscription = Row & {
  gymId: string;
  planName: string;
  setupFee: number;
  setupFeeStatus: E<typeof FEE_STATUS>;
  monthlyFee: number;
  billingMonths: number;
  billingStartAt: string | null;
  nextBillingAt: string | null;
  status: E<typeof SUB_STATUS>;
  graceDays: number;
  autoSuspend: boolean;
  gstRate: number;
  notes: string | null;
};

export type PlatformInvoice = Row & {
  gymId: string;
  gymName: string;
  number: string;
  kind: E<typeof PINV_KIND>;
  sequence: number;
  periodStart: string | null;
  periodEnd: string | null;
  description: string | null;
  amount: number;
  gstRate: number;
  tax: number;
  total: number;
  status: E<typeof PINV_STATUS>;
  dueAt: string | null;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
};

/** Server action result shape used everywhere. */
export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
