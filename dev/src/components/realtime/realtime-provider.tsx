"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Client } from "appwrite";
import { Info } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type LiveTable = "checkins" | "members" | "payments" | "invoices" | "messages" | "leads" | "memberships" | "punches";
type LiveEvent = { table: LiveTable; action: "create" | "update" | "delete"; row: Record<string, unknown> };
type Listener = (e: LiveEvent) => void;

type TokenFn = () => Promise<{ jwt: string; endpoint: string; project: string; db: string; gymId: string } | null>;

/** "live" = socket open · "connecting" = first connect · "reconnecting" = dropped, retrying · "off" = not available here (e.g. super-admin view). */
export type LiveStatus = "connecting" | "live" | "reconnecting" | "off";

const Ctx = React.createContext<{ on: (l: Listener) => () => void; connected: boolean; status: LiveStatus }>({
  on: () => () => {},
  connected: false,
  status: "connecting",
});

const TABLES: LiveTable[] = ["checkins", "members", "payments", "invoices", "messages", "leads", "memberships", "punches"];

type SocketHolder = { realtime?: { socket?: WebSocket } };

/**
 * One Appwrite Realtime socket per tab, authenticated with a 15-minute JWT
 * (renewed every 12 min). Row permissions scope events to this gym's team.
 * Status comes from the socket itself, so the UI never claims "live" when it isn't.
 */
const fetchToken: TokenFn = async () => {
  const r = await fetch("/api/realtime/token", { cache: "no-store" });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()) as Awaited<ReturnType<TokenFn>>;
};

export function RealtimeProvider({ getToken = fetchToken, children }: { getToken?: TokenFn; children: React.ReactNode }) {
  const listeners = React.useRef(new Set<Listener>());
  const [status, setStatus] = React.useState<LiveStatus>("connecting");

  React.useEffect(() => {
    let unsub: (() => void) | null = null;
    let client: Client | null = null;
    let renew: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    let everOpen = false;

    const connect = async () => {
      if (retry) clearTimeout(retry);
      try {
        const tok = await getToken();
        if (!alive) return;
        if (!tok) return setStatus("off");
        client = new Client().setEndpoint(tok.endpoint).setProject(tok.project).setJWT(tok.jwt);
        const channels = TABLES.map((t) => `tablesdb.${tok.db}.tables.${t}.rows`);
        unsub?.();
        const sub = client.subscribe(channels, (res) => {
          const ch = res.channels.find((c) => c.startsWith(`tablesdb.${tok.db}.tables.`) && c.endsWith(".rows"));
          const table = ch?.split(".")[3] as LiveTable | undefined;
          if (!table) return;
          const ev = res.events.find((e) => /\.(create|update|delete)$/.test(e)) ?? "";
          const action = (ev.split(".").pop() ?? "update") as LiveEvent["action"];
          const row = res.payload as Record<string, unknown>;
          if (row?.gymId && row.gymId !== tok.gymId) return; // belt and braces
          for (const l of listeners.current) l({ table, action, row });
        });
        unsub = typeof sub === "function" ? sub : () => void (sub as unknown as Promise<{ close?: () => void }>).then?.((x) => x?.close?.());
        if (renew) clearTimeout(renew);
        renew = setTimeout(connect, 12 * 60 * 1000);
      } catch {
        if (!alive) return;
        setStatus(everOpen ? "reconnecting" : "connecting");
        retry = setTimeout(connect, 15_000);
      }
    };

    // Read the SDK's socket state (it reconnects on its own with back-off).
    const poll = setInterval(() => {
      if (!client) return;
      const state = (client as unknown as SocketHolder).realtime?.socket?.readyState;
      if (state === WebSocket.OPEN) {
        everOpen = true;
        setStatus("live");
      } else if (state !== undefined) setStatus((s) => (s === "off" ? s : everOpen || !navigator.onLine ? "reconnecting" : "connecting"));
    }, 1500);

    void connect();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !unsub) void connect();
    };
    const onOnline = () => void connect();
    const onOffline = () => setStatus((s) => (s === "off" ? s : "reconnecting"));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      alive = false;
      unsub?.();
      clearInterval(poll);
      if (renew) clearTimeout(renew);
      if (retry) clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [getToken]);

  const on = React.useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => void listeners.current.delete(l);
  }, []);

  return <Ctx.Provider value={{ on, connected: status === "live", status }}>{children}</Ctx.Provider>;
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

const LIVE_COPY: Record<LiveStatus, { label: string; help: string; dot: string }> = {
  live: {
    label: "Live",
    help: "New check-ins from this desk, other staff, fingerprint or face machines and the Face ID kiosk appear here instantly — no need to refresh.",
    dot: "bg-success",
  },
  connecting: { label: "Connecting…", help: "Setting up live updates. This takes a few seconds after the page opens.", dot: "bg-warning" },
  reconnecting: {
    label: "Not live",
    help: "Live updates paused — usually the internet dropped or the computer was asleep. You can still check people in. We reconnect automatically and refresh this page every 30 seconds until then.",
    dot: "bg-warning",
  },
  off: {
    label: "Live off",
    help: "Live updates are turned off in the super-admin view. Refresh the page to see new check-ins.",
    dot: "bg-subtle",
  },
};

/** Connection pill with an explanation, for pages that update live. */
export function LiveDot({ className }: { className?: string }) {
  const { status } = useRealtime();
  const copy = LIVE_COPY[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${copy.label}. ${copy.help}`}
          className={`inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
        >
          <span className="relative flex size-2">
            {status === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />}
            <span className={`relative inline-flex size-2 rounded-full ${copy.dot}`} />
          </span>
          {copy.label}
          <Info className="size-3.5 opacity-60" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72 text-left leading-snug">
        {copy.help}
      </TooltipContent>
    </Tooltip>
  );
}

/** Calls `fn` every `ms` while live updates are not flowing (fallback so screens never go stale). */
export function usePollWhenNotLive(fn: () => void, ms = 30_000) {
  const { status } = useRealtime();
  const ref = React.useRef(fn);
  React.useEffect(() => {
    ref.current = fn;
  });
  React.useEffect(() => {
    if (status === "live") return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [status, ms]);
}
