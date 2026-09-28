export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "static",
  "cdn",
  "assets",
  "help",
  "support",
  "status",
  "docs",
  "blog",
  "login",
  "auth",
  "dashboard",
  "billing",
  "gym",
  "gymos",
  "avnix",
  "test",
  "demo",
  "staging",
  "dev",
  "ns1",
  "ns2",
]);

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** DNS-label safe: 3–40 chars, a-z 0-9 and inner hyphens. */
export function validateSlug(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 characters";
  if (slug.length > 40) return "Use at most 40 characters";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return "Only lowercase letters, numbers and hyphens";
  if (RESERVED_SLUGS.has(slug)) return "This name is reserved";
  return null;
}

export function isValidDomain(d: string) {
  return /^(?=.{4,253}$)(?!-)(?:[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/.test(d);
}
