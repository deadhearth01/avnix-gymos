import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { faceIdsData } from "@/lib/queries/gym";
import { PageHeader } from "@/components/kit/page-header";
import { MembersTabs } from "../members-tabs";
import { FaceIdsView } from "./face-ids-view";

export const metadata = { title: "Face IDs" };

export default async function FaceIdsPage() {
  const ctx = await requireCap("members.view");
  const rows = await faceIdsData(ctx.gymId);
  return (
    <>
      <PageHeader
        title="Face IDs"
        description="Everyone who can check in with their face. Open a photo to confirm each Face ID belongs to the right person."
        crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Members", href: "/members" }, { label: "Face IDs" }]}
      />
      <MembersTabs faceCount={rows.length} />
      <FaceIdsView rows={rows} canEdit={can(ctx.role, "members.edit")} />
    </>
  );
}
