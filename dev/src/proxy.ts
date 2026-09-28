import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Host-based routing + optimistic auth gate.
 *
 *   gym.avnix.in / localhost          → the product (login, dashboard, admin)
 *   <slug>.gym.avnix.in / <slug>.localhost → that gym's public website  (/s/<slug>)
 *   any other host (custom domain)    → gym website looked up by domain (/s/~<host>)
 *
 * Real authorization happens in every page/server action (getGymContext /
 * requireCap / requireSuperAdmin). This only avoids rendering protected pages
 * for visitors without a session cookie.
 */

const ROOT = (process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gym.avnix.in").toLowerCase();
const EXTRA_APP_HOSTS = (process.env.APP_HOSTS || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const RESERVED = new Set(["www", "app", "admin", "api", "mail", "static", "cdn"]);

const PROTECTED = [
  "/dashboard",
  "/members",
  "/plans",
  "/billing",
  "/front-desk",
  "/leads",
  "/automations",
  "/finance",
  "/website",
  "/settings",
  "/admin",
  "/staff",
];

type HostKind = { kind: "app" } | { kind: "site"; slug: string } | { kind: "domain"; host: string };

function classify(rawHost: string): HostKind {
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

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const target = classify(host);

  if (target.kind !== "app") {
    // Staff who type <gym>.gym.avnix.in/login land on the real sign-in page.
    if ((pathname === "/login" || pathname === "/dashboard" || pathname === "/admin") && !host.includes("localhost")) {
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      return NextResponse.redirect(new URL(`${proto}://${ROOT}${pathname}`));
    }
    // Public gym website. API routes stay reachable for form posts.
    if (pathname.startsWith("/api/") || pathname.startsWith("/s/")) return NextResponse.next();
    const key = target.kind === "site" ? target.slug : `~${target.host}`;
    const url = req.nextUrl.clone();
    url.pathname = `/s/${encodeURIComponent(key)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!req.cookies.get(SESSION_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }
  if (pathname === "/login" && req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)"],
};
