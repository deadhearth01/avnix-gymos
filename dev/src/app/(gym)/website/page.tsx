import { requireCap } from "@/lib/auth/session";
import type { GymSite } from "@/lib/types";
import { WebsiteEditor } from "./website-editor";

export const metadata = { title: "Website editor" };

export default async function WebsitePage() {
  const { gym } = await requireCap("website.manage");
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
    />
  );
}
