import { getGymContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listPlans } from "@/lib/queries/gym";
import { PlansView } from "./plans-view";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const ctx = await getGymContext();
  const plans = await listPlans(ctx.gymId, true);
  return <PlansView plans={plans} editable={can(ctx.role, "plans.manage")} />;
}
