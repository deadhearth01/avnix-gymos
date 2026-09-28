/** Host classification shared by the proxy and host-aware metadata routes (robots, sitemap). */
export const ROOT = (process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gym.avnix.in").toLowerCase();
const EXTRA_APP_HOSTS = (process.env.APP_HOSTS || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const RESERVED = new Set(["www", "app", "admin", "api", "mail", "static", "cdn"]);

export type HostKind = { kind: "app" } | { kind: "site"; slug: string } | { kind: "domain"; host: string };

export function classify(rawHost: string): HostKind {
  const host = rawHost.split(":")[0].toLowerCase().replace(/\.$/, "");
  if (!host || host === ROOT || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || EXTRA_APP_HOSTS.includes(host)) {
    return { kind: "app" };
  }
  for (const base of [ROOT, "localhost"]) {
    if (host.endsWith(`.${base}`)) {
      const sub = host.slice(0, -(base.length + 1));
      if (!sub.includes(".") && !RESERVED.has(sub)) return { kind: "site", slug: sub };
      return { kind: "app" };
    }
  }
  // Appwrite Sites default domains / preview hosts → treat as the app
  if (host.endsWith(".appwrite.network") || host.includes(".sites.")) return { kind: "app" };
  return { kind: "domain", host };
}
