import type { MetadataRoute } from "next";
import { requestTarget } from "@/lib/site/request-gym";
import { siteUrl } from "@/lib/site/url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const target = await requestTarget();
  if (target.kind === "app") {
    return {
      rules: [{ userAgent: "*", allow: ["/$", "/icon.svg", "/brand/", "/_next/static/"], disallow: ["/"] }],
      sitemap: `${target.origin}/sitemap.xml`,
      host: target.origin,
    };
  }
  const gym = target.gym;
  if (!gym || gym.status !== "active" || gym.siteEnabled === false) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const url = siteUrl(gym);
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${url}/sitemap.xml`, host: url };
}
