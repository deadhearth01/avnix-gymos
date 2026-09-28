import type { StaffRole } from "@/lib/types";

const ALL: StaffRole[] = ["owner", "manager", "frontdesk", "trainer"];
const DESK: StaffRole[] = ["owner", "manager", "frontdesk"];
const ADMIN: StaffRole[] = ["owner", "manager"];
const OWNER: StaffRole[] = ["owner"];

export const CAPABILITIES = {
  "dashboard.view": ALL,
  "dashboard.money": ADMIN,
  "members.view": ALL,
  "members.edit": DESK,
  "members.delete": ADMIN,
  "plans.view": ALL,
  "plans.manage": ADMIN,
  "billing.view": DESK,
  "billing.collect": DESK,
  "billing.void": ADMIN,
  "checkins.create": ALL,
  "leads.view": ALL,
  "leads.edit": DESK,
  "finance.view": ADMIN,
  "finance.edit": ADMIN,
  "automations.view": DESK,
  "automations.manage": ADMIN,
  "messages.send": DESK,
  "website.manage": ADMIN,
  "settings.manage": OWNER,
  "staff.manage": OWNER,
  "audit.view": ADMIN,
} as const satisfies Record<string, StaffRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: StaffRole | null | undefined, cap: Capability) {
  return !!role && (CAPABILITIES[cap] as readonly StaffRole[]).includes(role);
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  frontdesk: "Front desk",
  trainer: "Trainer",
};

const RANK: StaffRole[] = ["owner", "manager", "frontdesk", "trainer"];
export function highestRole(roles: string[]): StaffRole | null {
  return RANK.find((r) => roles.includes(r)) ?? null;
}
