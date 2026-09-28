"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { CornerDownLeft, Loader2, Search, UserRound, type IconComponent } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { emitFeedback } from "@/components/feedback/feedback-provider";

export type PaletteAction = {
  id: string;
  label: string;
  icon: IconComponent;
  group: string;
  href?: string;
  run?: () => void;
  keywords?: string;
  shortcut?: string;
};
export type PaletteHit = { id: string; title: string; subtitle?: string; href: string };

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const hitValue = (h: PaletteHit) => `hit ${h.title} ${h.subtitle ?? ""} ${h.id}`;
const PaletteContext = React.createContext<Ctx>({ open: false, setOpen: () => {} });
export const useCommandPalette = () => React.useContext(PaletteContext);

export function CommandPaletteProvider({
  actions,
  search,
  children,
}: {
  actions: PaletteAction[];
  search?: (q: string) => Promise<PaletteHit[]>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PaletteHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState("");
  const router = useRouter();

  const openRef = React.useRef(open);
  const setOpenAndReset = React.useCallback((v: boolean) => {
    openRef.current = v;
    setOpen(v);
    if (!v) {
      setQuery("");
      setHits([]);
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenAndReset(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpenAndReset]);
  const remote = !!search && query.trim().length >= 2;
  const visibleHits = remote ? hits : [];

  // Debounced remote search (members, leads…)
  React.useEffect(() => {
    if (!search || query.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await search(query.trim());
        if (alive) {
          setHits(r);
          if (r[0]) setSelected(hitValue(r[0]));
        }
      } catch {
        if (alive) setHits([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, search]);

  const go = (a: { href?: string; run?: () => void }) => {
    emitFeedback("select");
    setOpenAndReset(false);
    if (a.run) a.run();
    else if (a.href) router.push(a.href);
  };

  const groups = React.useMemo(() => {
    const m = new Map<string, PaletteAction[]>();
    for (const a of actions) m.set(a.group, [...(m.get(a.group) ?? []), a]);
    return [...m.entries()];
  }, [actions]);

  return (
    <PaletteContext.Provider value={{ open, setOpen: setOpenAndReset }}>
      {children}
      <Dialog open={open} onOpenChange={setOpenAndReset}>
        <DialogContent
          showCloseButton={false}
          className="top-[18%] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden rounded-2xl border p-0 shadow-[var(--shadow-pop)] sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Jump to pages, run actions or find members.</DialogDescription>
          <Command loop shouldFilter value={selected} onValueChange={setSelected} className="flex flex-col" label="Command menu">
            <div className="flex items-center gap-2.5 border-b px-4">
              {loading && remote ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Search className="size-4 text-muted-foreground" />}
              <Command.Input
                value={query}
                onValueChange={(v) => {
                  setQuery(v);
                  setLoading(!!search && v.trim().length >= 2);
                }}
                placeholder="Search members, pages, actions…"
                className="h-13 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
              />
              <kbd className="rounded-md border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">esc</kbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] scrollbar-thin overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">{loading && remote ? "Searching…" : "No results."}</Command.Empty>
              {visibleHits.length > 0 && (
                <Command.Group heading="People" className="palette-group">
                  {visibleHits.map((h) => (
                    <Command.Item key={h.id} value={hitValue(h)} keywords={[query]} onSelect={() => go(h)} className="palette-item">
                      <PersonAvatar name={h.title} size={26} />
                      <span className="flex-1 truncate">
                        {h.title}
                        {h.subtitle && <span className="ml-2 text-muted-foreground">{h.subtitle}</span>}
                      </span>
                      <UserRound className="size-3.5 text-subtle" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {groups.map(([group, items]) => (
                <Command.Group key={group} heading={group} className="palette-group">
                  {items.map((a) => (
                    <Command.Item key={a.id} value={`${a.label} ${a.keywords ?? ""}`} onSelect={() => go(a)} className="palette-item anim-host">
                      <span className="grid size-7 place-items-center rounded-lg border bg-card text-muted-foreground shadow-[var(--shadow-card)]">
                        <AnimatedIcon icon={a.icon} className="size-4" />
                      </span>
                      <span className="flex-1 truncate">{a.label}</span>
                      {a.shortcut && <kbd className="font-mono text-[11px] text-subtle">{a.shortcut}</kbd>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
            <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border bg-card px-1 font-mono">↑</kbd>
                <kbd className="rounded border bg-card px-1 font-mono">↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="size-3.5" /> open
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </PaletteContext.Provider>
  );
}
