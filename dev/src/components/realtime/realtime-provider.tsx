"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Client } from "appwrite";

export type LiveTable = "checkins" | "members" | "payments" | "invoices" | "messages" | "leads" | "memberships";
type LiveEvent = { table: LiveTable; action: "create" | "update" | "delete"; row: Record<string, unknown> };
type Listener = (e: LiveEvent) => void;

type TokenFn = () => Promise<{ jwt: string; endpoint: string; project: string; db: string; gymId: string } | null>;

const Ctx = React.createContext<{ on: (l: Listener) => () => void; connected: boolean }>({ on: () => () => {}, connected: false });

const TABLES: LiveTable[] = ["checkins", "members", "payments", "invoices", "messages", "leads", "memberships"];

/**
 * One Appwrite Realtime socket per tab, authenticated with a 15-minute JWT
 * (renewed every 12 min). Row permissions scope events to this gym's team.
 */
export function RealtimeProvider({ getToken, children }: { getToken: TokenFn; children: React.ReactNode }) {
  const listeners = React.useRef(new Set<Listener>());
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = async () => {
      try {
        const tok = await getToken();
        if (!alive || !tok) return;
        const client = new Client().setEndpoint(tok.endpoint).setProject(tok.project).setJWT(tok.jwt);
        const channels = TABLES.map((t) => `tablesdb.${tok.db}.tables.${t}.rows`);
        unsub?.();
        unsub = client.subscribe(channels, (res) => {
          const ch = res.channels.find((c) => c.startsWith(`tablesdb.${tok.db}.tables.`) && c.endsWith(".rows"));
          const table = ch?.split(".")[3] as LiveTable | undefined;
          if (!table) return;
          const ev = res.events.find((e) => /\.(create|update|delete)$/.test(e)) ?? "";
          const action = (ev.split(".").pop() ?? "update") as LiveEvent["action"];
          const row = res.payload as Record<string, unknown>;
          if (row?.gymId && row.gymId !== tok.gymId) return; // belt and braces
          for (const l of listeners.current) l({ table, action, row });
        });
        setConnected(true);
      } catch {
        setConnected(false);
      }
      if (alive) timer = setTimeout(connect, 12 * 60 * 1000);
    };
    void connect();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !unsub) void connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      unsub?.();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getToken]);

  const on = React.useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => void listeners.current.delete(l);
  }, []);

  return <Ctx.Provider value={{ on, connected }}>{children}</Ctx.Provider>;
}

export const useRealtime = () => React.useContext(Ctx);

/** Subscribe to live row events. */
export function useLiveEvents(tables: LiveTable[], handler: Listener) {
  const { on } = useRealtime();
  const ref = React.useRef(handler);
  React.useEffect(() => {
    ref.current = handler;
  });
  const key = tables.join(",");
  React.useEffect(() => on((e) => key.split(",").includes(e.table) && ref.current(e)), [on, key]);
}

/** Refresh server components when rows in these tables change (throttled). */
export function useLiveRefresh(tables: LiveTable[], delayMs = 700) {
  const router = useRouter();
  const t = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents(tables, () => {
    if (t.current) return;
    t.current = setTimeout(() => {
      t.current = null;
      React.startTransition(() => router.refresh());
    }, delayMs);
  });
}

/** Drop-in: <LiveRefresh tables={["checkins"]} /> inside any server page. */
export function LiveRefresh({ tables }: { tables: LiveTable[] }) {
  useLiveRefresh(tables);
  return null;
}

export function LiveDot() {
  const { connected } = useRealtime();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={connected ? "Live updates on" : "Connecting…"}>
      <span className="relative flex size-2">
        {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />}
        <span className={`relative inline-flex size-2 rounded-full ${connected ? "bg-success" : "bg-subtle"}`} />
      </span>
      {connected ? "Live" : "Offline"}
    </span>
  );
}
