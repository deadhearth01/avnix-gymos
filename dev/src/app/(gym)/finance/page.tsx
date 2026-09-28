import { requireCap } from "@/lib/auth/session";
import { financeData } from "@/lib/queries/gym";
import { FinanceView } from "./finance-view";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const ctx = await requireCap("finance.view");
  const data = await financeData(ctx.gymId);
  return <FinanceView {...data} />;
}
