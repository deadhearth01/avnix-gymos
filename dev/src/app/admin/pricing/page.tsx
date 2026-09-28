import { requireSuperAdmin } from "@/lib/auth/session";
import { getPricing } from "@/lib/services/pricing";
import { PricingEditor } from "./pricing-editor";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  await requireSuperAdmin();
  return <PricingEditor initial={await getPricing()} />;
}
