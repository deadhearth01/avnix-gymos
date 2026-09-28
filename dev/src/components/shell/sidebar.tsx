"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronsUpDown, Compass, PanelLeftClose, PanelLeft, Search, LifeBuoy, LogOut, ShieldCheck, Check, Volume2, Sparkles } from "lucide-react";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { LogoTile } from "@/components/brand/logo";
import { PersonAvatar } from "@/components/kit/person-avatar";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { useCommandPalette } from "@/components/shell/command-palette";
import { startTour } from "@/components/shell/onboarding-tour";
import type { NavItem } from "@/components/shell/nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type SidebarProps = {
  brand: { name: string; subtitle?: string; logoUrl?: string | null; color?: string | null; gymos?: boolean };
  sections: { section?: string; items: NavItem[] }[];
  footer?: NavItem[];
  counts?: Partial<Record<NonNullable<NavItem["countKey"]>, number>>;
  user: { name: string; email: string };
  switcher?: { id: string; name: string; active: boolean }[];
  onSwitch?: (id: string) => void;
  superAdmin?: boolean;
  variant: "gym" | "admin";
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
  mobile?: boolean;
  onNavigate?: () => void;
};

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar(props: SidebarProps) {
  const {
    brand,
    sections,
    footer = [],
    counts = {},
    user,
    switcher,
    onSwitch,
    superAdmin,
    variant,
    collapsed = false,
    onCollapsedChange,
    mobile,
    onNavigate,
  } = props;
  const pathname = usePathname();
  const palette = useCommandPalette();
  const { settings, setSettings } = useFeedback();
  const c = collapsed && !mobile;

  return (
    <motion.aside
      initial={false}
      animate={{ width: mobile ? "100%" : c ? 72 : 264 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        !mobile && "rounded-2xl border shadow-[var(--shadow-card)]",
      )}
    >
      {/* Brand / switcher */}
      <div className={cn("flex items-center gap-1.5 p-3 pb-2", c && "flex-col")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn("anim-host flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-muted", c && "flex-none")}
            >
              {brand.gymos ? <LogoTile size={32} /> : <BrandMark name={brand.name} logoUrl={brand.logoUrl} color={brand.color} />}
              {!c && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{brand.name}</span>
                    {brand.subtitle && <span className="block truncate text-xs text-muted-foreground">{brand.subtitle}</span>}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 text-subtle" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {switcher && switcher.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Your gyms</DropdownMenuLabel>
                {switcher.map((g) => (
                  <DropdownMenuItem key={g.id} onSelect={() => !g.active && onSwitch?.(g.id)}>
                    <BrandMark name={g.name} size={22} />
                    <span className="flex-1 truncate">{g.name}</span>
                    {g.active && <Check className="size-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            {superAdmin && variant === "gym" && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <ShieldCheck className="size-4" /> Admin console
                </Link>
              </DropdownMenuItem>
            )}
            {superAdmin && variant === "admin" && (
              <DropdownMenuItem asChild>
                <Link href="/admin/gyms">
                  <Sparkles className="size-4" /> Open a gym workspace
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {!mobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={c ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => onCollapsedChange?.(!collapsed)}
                className="anim-host grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <AnimatedIcon icon={c ? PanelLeft : PanelLeftClose} className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{c ? "Expand" : "Collapse"} · [</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          data-tour="search"
          className={cn(
            "anim-host flex h-9 w-full items-center gap-2 rounded-[10px] bg-muted/80 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            c && "justify-center px-0",
          )}
        >
          <AnimatedIcon icon={Search} className="size-4" />
          {!c && (
            <>
              <span className="flex-1 text-left">Quick Search</span>
              <kbd className="rounded-md border bg-card px-1.5 font-mono text-[11px] text-muted-foreground shadow-[var(--shadow-card)]">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 scrollbar-thin overflow-y-auto px-3 py-1">
        {sections.map((s, si) => (
          <div key={si} className="mb-2">
            {s.section && !c && <p className="px-2.5 pt-3 pb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">{s.section}</p>}
            <ul className="flex flex-col gap-0.5">
              {s.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={c}
                  count={item.countKey ? counts[item.countKey] : undefined}
                  onNavigate={onNavigate}
                  layoutGroup={variant}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-1 px-3 pt-2 pb-3">
        <div className={cn("mb-2 px-1", c && "flex justify-center px-0")}>
          <ThemeSwitch collapsed={c} />
        </div>
        <ul className="flex flex-col gap-0.5">
          <NavLink
            item={{ href: "mailto:support@avnix.in?subject=GymOS%20support", label: "Support", icon: LifeBuoy }}
            active={false}
            collapsed={c}
            external
            layoutGroup={variant}
          />
          {footer.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={c} onNavigate={onNavigate} layoutGroup={variant} />
          ))}
        </ul>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "anim-host mt-2 flex items-center gap-2.5 rounded-xl border bg-muted/50 p-2 text-left transition-colors hover:bg-muted",
                c && "justify-center border-transparent bg-transparent p-1",
              )}
            >
              <PersonAvatar name={user.name || user.email} size={32} />
              {!c && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{user.name || "Account"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 text-subtle" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={c ? "right" : "top"} align="start" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Volume2 className="size-4 text-muted-foreground" /> Sounds &amp; haptics
              </span>
              <Switch
                checked={settings.sound && settings.haptics}
                onCheckedChange={(v) => setSettings({ sound: v, haptics: v })}
                aria-label="Toggle sounds and haptics"
              />
            </div>
            <DropdownMenuSeparator />
            {variant === "gym" && (
              <DropdownMenuItem onSelect={() => window.setTimeout(startTour, 150)}>
                <Compass className="size-4" /> Take the tour
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  count,
  external,
  onNavigate,
  layoutGroup,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
  external?: boolean;
  onNavigate?: () => void;
  layoutGroup: string;
}) {
  const content = (
    <>
      {active && (
        <motion.span
          layoutId={`nav-active-${layoutGroup}`}
          className="absolute inset-0 rounded-[10px] bg-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_4px_12px_-4px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative z-10 flex w-full items-center gap-2.5">
        <AnimatedIcon icon={item.icon} className="size-[18px]" wrapperClassName={cn(collapsed && "mx-auto")} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        <AnimatePresence initial={false}>
          {!collapsed && count != null && count > 0 && (
            <motion.span
              key="count"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className={cn(
                "tabular min-w-6 rounded-md px-1.5 text-center text-[11px] leading-5 font-semibold",
                active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {count > 999 ? "999+" : count}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </>
  );

  const cls = cn(
    "anim-host relative flex h-9 items-center rounded-[10px] px-2.5 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
    active ? "text-primary-foreground" : "text-sidebar-foreground/85 hover:bg-muted hover:text-foreground",
    collapsed && "justify-center px-0",
  );

  const link = external ? (
    <a href={item.href} className={cls} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      {content}
    </Link>
  );

  return (
    <li data-tour={`nav${item.href.startsWith("/") ? item.href.replace(/\//g, "-") : "-support"}`}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
            {count ? ` · ${count}` : ""}
          </TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}

/** POSTs to the sign-out route, then hard-navigates so no stale client state survives. */
export async function signOut() {
  try {
    await fetch("/auth/signout", { method: "POST", redirect: "manual", credentials: "same-origin" });
  } finally {
    window.location.assign("/login");
  }
}

export function BrandMark({ name, logoUrl, color, size = 32 }: { name: string; logoUrl?: string | null; color?: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[9px] object-cover ring-1 ring-black/5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[9px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(145deg, ${color || "#16a34a"}, color-mix(in oklab, ${color || "#16a34a"} 70%, black))`,
      }}
    >
      {(name || "G").trim()[0]?.toUpperCase()}
    </span>
  );
}
