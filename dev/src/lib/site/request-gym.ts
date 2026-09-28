import "server-only";
import { headers } from "next/headers";
import { resolveSite } from "@/lib/queries/site";
import { classify, ROOT } from "@/lib/site/host";
import type { Gym } from "@/lib/types";

/** For host-aware metadata routes: which gym (if any) is this request for? */
export async function requestTarget(): Promise<{ kind: "app"; origin: string } | { kind: "gym"; gym: Gym | null }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const target = classify(host);
  if (target.kind === "app") {
    const local = host.includes("localhost") || host.startsWith("127.");
    return { kind: "app", origin: local ? `http://${host}` : `https://${ROOT}` };
  }
  const gym = await resolveSite(target.kind === "site" ? target.slug : `~${target.host}`).catch(() => null);
  return { kind: "gym", gym };
}
