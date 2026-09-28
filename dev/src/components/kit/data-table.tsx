"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Search, X, type LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/kit/empty-state";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sort?: (row: T) => string | number | null | undefined;
  className?: string;
  headClassName?: string;
  align?: "left" | "right" | "center";
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

export type Filter<T> = {
  id: string;
  label: string;
  allLabel?: string;
  options: { value: string; label: string; count?: number }[];
  match: (row: T, value: string) => boolean;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  noun?: [string, string];
  search?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  initialSort?: { id: string; dir: "asc" | "desc" };
  initialFilters?: Record<string, string[]>;
  pageSize?: number;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  empty?: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode };
  className?: string;
  dense?: boolean;
  /** Card renderer used below the `sm` breakpoint instead of the table. */
  mobileCard?: (row: T) => React.ReactNode;
};

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>({
  rows,
  columns,
  getId,
  noun = ["result", "results"],
  search,
  searchPlaceholder = "Search",
  filters = [],
  initialSort,
  initialFilters,
  pageSize = 10,
  selectable,
  bulkActions,
  rowHref,
  onRowClick,
  toolbar,
  empty,
  className,
  dense,
  mobileCard,
}: Props<T>) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState<Record<string, string[]>>(initialFilters ?? {});
  const [sort, setSort] = React.useState(initialSort ?? null);
  const [rawPage, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const deferredQ = React.useDeferredValue(q);

  const filtered = React.useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    let out = rows;
    if (needle && search) out = out.filter((r) => search(r).toLowerCase().includes(needle));
    for (const f of filters) {
      const vals = active[f.id];
      if (vals?.length) out = out.filter((r) => vals.some((v) => f.match(r, v)));
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sort) {
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = col.sort!(a);
          const bv = col.sort!(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av > bv ? dir : av < bv ? -dir : 0;
        });
      }
    }
    return out;
  }, [rows, deferredQ, search, filters, active, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(rawPage, pages);
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selectedRows = React.useMemo(() => rows.filter((r) => selected.has(getId(r))), [rows, selected, getId]);
  const allOnPage = slice.length > 0 && slice.every((r) => selected.has(getId(r)));
  const someOnPage = slice.some((r) => selected.has(getId(r)));

  const toggleSort = (id: string) => {
    setPage(1);
    setSort((s) => (s?.id !== id ? { id, dir: "desc" } : s.dir === "desc" ? { id, dir: "asc" } : null));
  };

  const activeCount = Object.values(active).reduce((n, v) => n + v.length, 0);
  const clickable = !!rowHref || !!onRowClick;

  return (
    <div className={cn("surface overflow-hidden", className)}>
      {/* toolbar */}
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">Total results</p>
          <p className="tabular text-[15px] font-semibold">
            {filtered.length.toLocaleString("en-IN")} {filtered.length === 1 ? noun[0] : noun[1]}
            {filtered.length !== rows.length && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">of {rows.length.toLocaleString("en-IN")}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => {
            const vals = active[f.id] ?? [];
            const label =
              vals.length === 0
                ? (f.allLabel ?? `All ${f.label.toLowerCase()}`)
                : vals.length === 1
                  ? f.options.find((o) => o.value === vals[0])?.label
                  : `${f.label} · ${vals.length}`;
            return (
              <DropdownMenu key={f.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "anim-host inline-flex h-9 items-center gap-1.5 rounded-[10px] border bg-card px-3 text-sm shadow-[var(--shadow-card)] transition-colors hover:bg-muted/70",
                      vals.length > 0 && "border-primary/40 bg-success-soft/40 text-success-ink",
                    )}
                  >
                    {label}
                    <ChevronDown className="size-4 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{f.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {f.options.map((o) => (
                    <DropdownMenuCheckboxItem
                      key={o.value}
                      checked={vals.includes(o.value)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(c) => {
                        setPage(1);
                        setActive((a) => ({ ...a, [f.id]: c ? [...(a[f.id] ?? []), o.value] : (a[f.id] ?? []).filter((v) => v !== o.value) }));
                      }}
                    >
                      <span className="flex-1">{o.label}</span>
                      {o.count != null && <span className="tabular text-xs text-muted-foreground">{o.count}</span>}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setActive({});
                setPage(1);
              }}
              className="anim-host inline-flex h-9 items-center gap-1 rounded-[10px] px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <AnimatedIcon icon={X} className="size-3.5" /> Clear
            </button>
          )}
          {search && (
            <label className="anim-host relative flex h-9 w-full items-center sm:w-56">
              <AnimatedIcon icon={Search} className="size-4" wrapperClassName="pointer-events-none absolute left-3 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-[10px] border-0 bg-muted/80 pr-8 pl-9 text-sm transition-shadow outline-none placeholder:text-subtle focus:bg-card focus:ring-2 focus:ring-primary/25"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQ("");
                    setPage(1);
                  }}
                  className="absolute right-2 grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
          )}
          {toolbar}
        </div>
      </div>

      {/* bulk bar */}
      {selectable && selectedRows.length > 0 && bulkActions && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 border-b bg-success-soft/40 px-4 py-2 text-sm"
        >
          <span className="font-medium">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">{bulkActions(selectedRows, () => setSelected(new Set()))}</div>
          <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </motion.div>
      )}

      {/* table */}
      {filtered.length === 0 ? (
        empty ? (
          <EmptyState
            icon={empty.icon}
            title={rows.length === 0 ? empty.title : "Nothing matches"}
            description={rows.length === 0 ? empty.description : "Try a different search or clear the filters."}
            action={rows.length === 0 ? empty.action : undefined}
          />
        ) : (
          <p className="py-14 text-center text-sm text-muted-foreground">No results</p>
        )
      ) : (
        <>
          {mobileCard && (
            <ul className="divide-y sm:hidden">
              {slice.map((r, i) => (
                <motion.li
                  key={getId(r)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
                  onClick={
                    clickable
                      ? (e) => {
                          if ((e.target as HTMLElement).closest("button,a,input,[role=checkbox],[role=menuitem],[data-no-row-click]")) return;
                          if (onRowClick) onRowClick(r);
                          else if (rowHref) router.push(rowHref(r));
                        }
                      : undefined
                  }
                  className={cn("px-4 py-3 active:bg-muted/60", clickable && "cursor-pointer")}
                >
                  {mobileCard(r)}
                </motion.li>
              ))}
            </ul>
          )}
          <div className={cn("scrollbar-thin overflow-x-auto", mobileCard && "hidden sm:block")}>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/55 text-left text-[13px] text-muted-foreground">
                  {selectable && (
                    <th className="w-10 py-2.5 pl-4">
                      <Checkbox
                        aria-label="Select page"
                        checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                        onCheckedChange={(c) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            for (const r of slice) c ? n.add(getId(r)) : n.delete(getId(r));
                            return n;
                          })
                        }
                      />
                    </th>
                  )}
                  {columns.map((c) => {
                    const sorted = sort?.id === c.id ? sort.dir : null;
                    return (
                      <th
                        key={c.id}
                        className={cn(
                          "px-4 py-2.5 font-medium whitespace-nowrap",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.hideBelow && HIDE[c.hideBelow],
                          c.headClassName,
                        )}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      >
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.id)}
                            className={cn(
                              "group/sort inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
                              sorted && "text-foreground",
                            )}
                          >
                            {c.header}
                            <span className={cn("transition-opacity", sorted ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60")}>
                              {sorted === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                            </span>
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody key={`${page}-${deferredQ}`}>
                {slice.map((r, i) => {
                  const id = getId(r);
                  const isSel = selected.has(id);
                  return (
                    <motion.tr
                      key={id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: Math.min(i * 0.018, 0.2), ease: [0.16, 1, 0.3, 1] }}
                      onClick={
                        clickable
                          ? (e) => {
                              if ((e.target as HTMLElement).closest("button,a,input,[role=checkbox],[role=menuitem],[data-no-row-click]")) return;
                              if (onRowClick) onRowClick(r);
                              else if (rowHref) router.push(rowHref(r));
                            }
                          : undefined
                      }
                      className={cn("border-t transition-colors", clickable && "cursor-pointer", isSel ? "bg-success-soft/30" : "hover:bg-muted/40")}
                    >
                      {selectable && (
                        <td className="py-3 pl-4">
                          <Checkbox
                            aria-label="Select row"
                            checked={isSel}
                            onCheckedChange={(c) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                c ? n.add(id) : n.delete(id);
                                return n;
                              })
                            }
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td
                          key={c.id}
                          className={cn(
                            "px-4 align-middle",
                            dense ? "py-2.5" : "py-3.5",
                            c.align === "right" && "text-right",
                            c.align === "center" && "text-center",
                            c.hideBelow && HIDE[c.hideBelow],
                            c.className,
                          )}
                        >
                          {c.cell(r)}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <PagerButton disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <AnimatedIcon icon={ArrowLeft} animation="nudge" className="size-4" /> <span className="hidden sm:inline">Previous</span>
          </PagerButton>
          <div className="flex items-center gap-1">
            {pageList(page, pages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-1.5 text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    "tabular relative grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm transition-colors",
                    p === page ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {p === page && <motion.span layoutId="pager-thumb" className="absolute inset-0 rounded-lg border bg-card shadow-[var(--shadow-card)]" />}
                  <span className="relative">{p}</span>
                </button>
              ),
            )}
          </div>
          <PagerButton disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
            <span className="hidden sm:inline">Next</span> <AnimatedIcon icon={ArrowRight} className="size-4" />
          </PagerButton>
        </div>
      )}
    </div>
  );
}

function PagerButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="anim-host inline-flex h-9 items-center gap-1.5 rounded-[10px] border bg-card px-3 text-sm shadow-[var(--shadow-card)] transition-colors hover:bg-muted/70 disabled:pointer-events-none disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}

function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}
