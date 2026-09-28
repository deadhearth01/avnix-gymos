import { Query } from "node-appwrite";
import { T } from "@/lib/appwrite/schema";
import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { repo } from "@/lib/data/repo";
import type { GymSite, Plan } from "@/lib/types";
import { WebsiteEditor } from "./website-editor";

export const metadata = { title: "Website editor" };

export default async function WebsitePage() {
  const { gym, role, gymId } = await requireCap("website.manage");
  const plans = (await repo(gymId).list<Plan>(T.plans, [Query.equal("active", true), Query.orderAsc("sortOrder"), Query.limit(100)], false)).rows;
  let site: GymSite = {};
  try {
    site = gym.site ? (JSON.parse(gym.site) as GymSite) : {};
  } catch {
    /* A malformed legacy site opens as a new draft. */
  }
  const subdomain = `https://${gym.slug}.${process.env.ROOT_DOMAIN}`;
  const customVerified = gym.customDomainEnabled && gym.customDomainStatus === "verified" && !!gym.customDomain;
  return (
    <WebsiteEditor
      initialSite={site}
      initialEnabled={gym.siteEnabled}
      gymName={gym.name}
      brandColor={gym.brandColor ?? "#16a34a"}
      subdomain={subdomain}
      customDomain={gym.customDomain}
      customDomainStatus={gym.customDomainStatus}
      customDomainEnabled={gym.customDomainEnabled}
      publicUrl={customVerified ? `https://${gym.customDomain}` : subdomain}
      previewUrl={`/s/${gym.slug}`}
      plans={plans.map((p) => ({ id: p.$id, name: p.name, type: p.type, price: p.price, sessions: p.sessions, durationDays: p.durationDays }))}
      canEditPrices={can(role, "plans.manage")}
    />
  );
}
