import { PageHeader } from "@/components/kit/page-header";
import { NewGymForm } from "./new-gym-form";

export const metadata = { title: "New gym" };

export default function NewGymPage() {
  return (
    <>
      <PageHeader
        title="Create a gym"
        description="One form sets up the owner's login, their team, starter plans, WhatsApp automations, a website and the billing schedule."
        crumbs={[{ label: "Console", href: "/admin" }, { label: "Gyms", href: "/admin/gyms" }, { label: "New" }]}
      />
      <NewGymForm />
    </>
  );
}
