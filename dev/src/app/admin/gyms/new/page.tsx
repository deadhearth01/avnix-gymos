import { PageHeader } from "@/components/kit/page-header";
import { getPricing } from "@/lib/services/pricing";
import { NewGymForm } from "./new-gym-form";

export const metadata = { title: "New gym" };

export default async function NewGymPage() {
  const pricing = await getPricing();
  return (
    <>
      <PageHeader
        title="Create a gym"
        description="One form sets up the owner's login, their team, starter plans, WhatsApp automations, a website and the billing schedule."
        crumbs={[{ label: "Console", href: "/admin" }, { label: "Gyms", href: "/admin/gyms" }, { label: "New" }]}
      />
      <NewGymForm pricing={pricing} />
    </>
  );
}
