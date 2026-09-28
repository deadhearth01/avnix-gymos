import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/kit/page-header";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { listGyms } from "@/lib/queries/admin";
import { GymsTable } from "./gyms-table";

export const metadata = { title: "Gyms" };

export default async function GymsPage() {
  const gyms = await listGyms();
  return (
    <>
      <PageHeader
        title="Gyms"
        description="Every tenant on the platform — their plan, fees, website and access."
        crumbs={[{ label: "Console", href: "/admin" }, { label: "Gyms" }]}
        actions={
          <Button asChild>
            <Link href="/admin/gyms/new">
              <AnimatedIcon icon={Plus} /> New gym
            </Link>
          </Button>
        }
      />
      <GymsTable
        gyms={gyms.map((g) => ({
          id: g.$id,
          name: g.name,
          slug: g.slug,
          city: g.city,
          brandColor: g.brandColor,
          status: g.status,
          ownerName: g.ownerName,
          ownerEmail: g.ownerEmail,
          plan: g.sub?.planName ?? "—",
          monthlyFee: g.sub?.monthlyFee ?? 0,
          billingMonths: g.sub?.billingMonths ?? 0,
          subStatus: g.sub?.status ?? null,
          outstanding: g.outstanding,
          members: g.members,
          createdAt: g.$createdAt,
          customDomain: g.customDomainEnabled && g.customDomainStatus === "verified" ? g.customDomain : null,
        }))}
      />
    </>
  );
}
