import "server-only";

import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";

/** AvniX's own price list for gyms — set once on /admin/pricing, applied when a gym is created. */
export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  setupFee: number;
  monthlyFee: number;
  /** 0 = bill until cancelled */
  billingMonths: number;
  gstRate: number;
  graceDays: number;
  autoSuspend: boolean;
};
export type Pricing = { plans: PricingPlan[]; defaultPlanId: string; allowCustom: boolean };

export const DEFAULT_PRICING: Pricing = {
  plans: [
    {
      id: "growth",
      name: "Growth",
      description: "Single-branch gym, all features",
      setupFee: 15000,
      monthlyFee: 1999,
      billingMonths: 12,
      gstRate: 18,
      graceDays: 7,
      autoSuspend: false,
    },
  ],
  defaultPlanId: "growth",
  allowCustom: true,
};

const ROW = "pricing";

export async function getPricing(): Promise<Pricing> {
  try {
    const row = await adminClient().tables.getRow<{ value: string } & import("node-appwrite").Models.Row>({
      databaseId: DB_ID,
      tableId: T.platformSettings,
      rowId: ROW,
    });
    const parsed = JSON.parse(row.value) as Pricing;
    return parsed.plans?.length ? parsed : DEFAULT_PRICING;
  } catch (e) {
    if (isAppwriteError(e) && e.code === 404) return DEFAULT_PRICING;
    throw e;
  }
}

export async function savePricing(pricing: Pricing) {
  const { tables } = adminClient();
  await tables.upsertRow({ databaseId: DB_ID, tableId: T.platformSettings, rowId: ROW, data: { value: JSON.stringify(pricing) } });
}

export function planFor(pricing: Pricing, id?: string | null) {
  return pricing.plans.find((p) => p.id === id) ?? pricing.plans.find((p) => p.id === pricing.defaultPlanId) ?? pricing.plans[0];
}
