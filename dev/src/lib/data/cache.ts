import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Server-side cache for heavy, per-gym reads (dashboard aggregates, billing, lists).
 * Every write to a gym's data expires its tag (see repo / audit / stats), so cached pages
 * never show stale numbers after a change; the TTL only bounds cross-server staleness.
 */
export const gymTag = (gymId: string) => `gym:${gymId}`;

export function cachedForGym<A extends unknown[], R>(name: string, fn: (gymId: string, ...args: A) => Promise<R>, ttlSeconds = 120) {
  return (gymId: string, ...args: A): Promise<R> =>
    unstable_cache(() => fn(gymId, ...args), [name, gymId, JSON.stringify(args)], { tags: [gymTag(gymId)], revalidate: ttlSeconds })();
}

/** Expire everything cached for this gym (no-op outside a Next request, e.g. scripts). */
export function invalidateGym(gymId: string | null | undefined) {
  if (!gymId) return;
  try {
    revalidateTag(gymTag(gymId), { expire: 0 });
  } catch {
    /* not in a request scope */
  }
}
