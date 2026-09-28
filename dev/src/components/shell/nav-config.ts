import {
  House,
  ScanLine,
  UsersRound,
  Target,
  ReceiptText,
  Layers,
  Workflow,
  Landmark,
  Globe,
  Settings,
  UserCog,
  Building2,
  CreditCard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/auth/rbac";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  cap?: Capability;
  countKey?: "members" | "leads" | "outbox";
  keywords?: string;
};

export const GYM_NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Home", icon: House, cap: "dashboard.view", keywords: "overview kpi" },
      { href: "/front-desk", label: "Front desk", icon: ScanLine, cap: "checkins.create", keywords: "check in attendance scan" },
      { href: "/members", label: "Members", icon: UsersRound, cap: "members.view", countKey: "members", keywords: "customers clients" },
      { href: "/leads", label: "Leads", icon: Target, cap: "leads.view", countKey: "leads", keywords: "enquiries trials pipeline" },
      { href: "/billing", label: "Billing", icon: ReceiptText, cap: "billing.view", keywords: "invoices payments dues" },
      { href: "/plans", label: "Plans", icon: Layers, cap: "plans.view", keywords: "membership pricing packages" },
      { href: "/automations", label: "Automations", icon: Workflow, cap: "automations.view", countKey: "outbox", keywords: "whatsapp sms journeys reminders" },
      { href: "/finance", label: "Finance", icon: Landmark, cap: "finance.view", keywords: "expenses profit p&l" },
      { href: "/website", label: "Website", icon: Globe, cap: "website.manage", keywords: "site domain microsite" },
    ],
  },
];

export const GYM_FOOTER_NAV: NavItem[] = [
  { href: "/staff", label: "Staff", icon: UserCog, cap: "staff.manage", keywords: "team users roles" },
  { href: "/settings", label: "Settings", icon: Settings, cap: "settings.manage", keywords: "gst profile preferences" },
];

export const ADMIN_NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Overview", icon: House },
      { href: "/admin/gyms", label: "Gyms", icon: Building2, keywords: "tenants clients" },
      { href: "/admin/billing", label: "Billing", icon: CreditCard, keywords: "subscriptions invoices fees" },
      { href: "/admin/audit", label: "Audit log", icon: ShieldCheck, keywords: "security activity" },
    ],
  },
];
