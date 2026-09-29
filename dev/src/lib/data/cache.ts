import "server-only";

/**
 * Server-side cache for heavy, per-gym reads (dashboard aggregates, billing, lists).
 *
 * In-memory and versioned: every write to a gym's data bumps that gym's version (see repo / audit /
 * stats), so the next read recomputes — saves are always visible straight away. Unlike Next's tag
 * cache, bumping a version doesn't force the current page to re-render inside a server action, which
 * kept saves (check-in, Face ID…) waiting an extra second. The TTL bounds staleness across servers.
 */
type Entry = { at: number; version: number; value: Promise<unknown> };

// On globalThis: Next bundles pages, actions and route handlers separately, and each bundle gets its
// own copy of module-level state. One shared store means a save in /api/* expires the pages' cache too.
const shared = globalThis as typeof globalThis & { __gymosCache?: { versions: Map<string, number>; store: Map<string, Entry> } };
const { versions, store } = (shared.__gymosCache ??= { versions: new Map(), store: new Map() });
const MAX_ENTRIES = 2000;

export function cachedForGym<A extends unknown[], R>(name: string, fn: (gymId: string, ...args: A) => Promise<R>, ttlSeconds = 120) {
  return (gymId: string, ...args: A): Promise<R> => {
    const key = `${gymId}|${name}|${JSON.stringify(args)}`;
    const version = versions.get(gymId) ?? 0;
    const hit = store.get(key);
    if (hit && hit.version === version && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as Promise<R>;
    const value = fn(gymId, ...args);
    store.set(key, { at: Date.now(), version, value });
    value.catch(() => store.delete(key)); // never cache failures
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!); // oldest first
    return value;
  };
}

/** Expire everything cached for this gym. Cheap; safe anywhere (actions, routes, scripts). */
export function invalidateGym(gymId: string | null | undefined) {
  if (!gymId) return;
  versions.set(gymId, (versions.get(gymId) ?? 0) + 1);
}
