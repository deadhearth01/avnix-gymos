import type { Gym } from "@/lib/types";

/** Canonical public address of a gym's website. */
export function siteUrl(gym: Pick<Gym, "slug" | "customDomain" | "customDomainEnabled" | "customDomainStatus">): string {
  if (gym.customDomainEnabled && gym.customDomain && gym.customDomainStatus === "verified") return `https://${gym.customDomain}`;
  const root = process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gym.avnix.in";
  return `https://${gym.slug}.${root}`;
}
