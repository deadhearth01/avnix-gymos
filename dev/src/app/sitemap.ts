import type { MetadataRoute } from "next";
import { requestTarget } from "@/lib/site/request-gym";
import { siteUrl } from "@/lib/site/url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const target = await requestTarget();
  if (target.kind === "app") return [{ url: `${target.origin}/`, changeFrequency: "weekly", priority: 1 }];
  const gym = target.gym;
  if (!gym || gym.status !== "active" || gym.siteEnabled === false) return [];
  return [{ url: `${siteUrl(gym)}/`, lastModified: gym.$updatedAt, changeFrequency: "weekly", priority: 1 }];
}
