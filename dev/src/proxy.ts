import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { ROOT, classify } from "@/lib/site/host";

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
  "/onboarding",
];

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
