"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Search, Eye, X, UserPlus, ScanLine, ReceiptText, Target, Building2, Sun, Moon } from "@/components/icons";
import { useTheme } from "next-themes";
import { ADMIN_NAV, GYM_FOOTER_NAV, GYM_NAV } from "@/components/shell/nav-config";
import { can } from "@/lib/auth/rbac";
import type { StaffRole } from "@/lib/types";
import { Sidebar, BrandMark, type SidebarProps } from "@/components/shell/sidebar";
import { CommandPaletteProvider, useCommandPalette, type PaletteAction, type PaletteHit } from "@/components/shell/command-palette";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { Button } from "@/components/ui/button";

type ShellProps = Omit<SidebarProps, "collapsed" | "onCollapsedChange" | "mobile" | "onNavigate" | "onSwitch" | "sections" | "footer"> & {
  initialCollapsed?: boolean;
  role?: StaffRole | null;
  search?: (q: string) => Promise<PaletteHit[]>;
  switchGym?: (id: string) => Promise<void>;
  impersonating?: { gymName: string; exit: () => Promise<void> } | null;
  children: React.ReactNode;
};

export function AppShell({ initialCollapsed = false, role, search, switchGym, impersonating, children, ...rest }: ShellProps) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const { resolvedTheme, setTheme } = useTheme();
  const sections = React.useMemo(
    () => (rest.variant === "admin" ? ADMIN_NAV : GYM_NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.cap || can(role, i.cap)) }))),
    [rest.variant, role],
  );
  const footer = React.useMemo(() => (rest.variant === "admin" ? [] : GYM_FOOTER_NAV.filter((i) => !i.cap || can(role, i.cap))), [rest.variant, role]);
  const sidebar = { ...rest, sections, footer };
  const actions = React.useMemo<PaletteAction[]>(() => {
    const nav = [...sections.flatMap((s) => s.items), ...footer].map((i) => ({
      id: i.href,
      label: i.label,
      icon: i.icon,
      group: "Go to",
      href: i.href,
      keywords: i.keywords,
    }));
    const quick: PaletteAction[] =
      rest.variant === "admin"
        ? [{ id: "new-gym", label: "Create a new gym", icon: Building2, group: "Actions", href: "/admin/gyms/new", keywords: "add tenant onboard" }]
        : [
            ...(can(role, "members.edit")
              ? [{ id: "add-member", label: "Add member", icon: UserPlus, group: "Actions", href: "/members?new=1", keywords: "join register" }]
              : []),
            ...(can(role, "checkins.create")
              ? [{ id: "check-in", label: "Check in a member", icon: ScanLine, group: "Actions", href: "/front-desk", keywords: "attendance" }]
              : []),
            ...(can(role, "billing.collect")
              ? [{ id: "collect", label: "Collect a payment", icon: ReceiptText, group: "Actions", href: "/billing?collect=1", keywords: "renew invoice pay" }]
              : []),
            ...(can(role, "leads.edit")
              ? [{ id: "add-lead", label: "Add a lead", icon: Target, group: "Actions", href: "/leads?new=1", keywords: "enquiry trial" }]
              : []),
          ];
    return [
      ...quick,
      ...nav,
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        group: "Preferences",
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ];
  }, [sections, footer, rest.variant, role, resolvedTheme, setTheme]);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const setCollapsedPersist = React.useCallback((v: boolean) => {
    setCollapsed(v);
    document.cookie = `gymos_sidebar=${v ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  // close the drawer whenever the route changes (incl. back/forward)
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) setCollapsedPersist(!collapsed);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsedPersist]);

  const onSwitch = switchGym
    ? (id: string) =>
        React.startTransition(async () => {
          await switchGym(id);
          router.refresh();
        })
    : undefined;

  return (
    <CommandPaletteProvider actions={actions} search={search}>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-dvh shrink-0 p-3 pr-0 lg:block print:hidden">
          <Sidebar {...sidebar} onSwitch={onSwitch} collapsed={collapsed} onCollapsedChange={setCollapsedPersist} />
        </div>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[86vw] max-w-[320px] border-r-0 p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main menu</SheetDescription>
            <Sidebar {...sidebar} onSwitch={onSwitch} mobile onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar name={sidebar.brand.name} logoUrl={sidebar.brand.logoUrl} color={sidebar.brand.color} onMenu={() => setMobileOpen(true)} />
          <AnimatePresence>
            {impersonating && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden px-3 pt-3 lg:px-4"
              >
                <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft px-3.5 py-2 text-sm text-warning-ink">
                  <Eye className="size-4 shrink-0" />
                  <span className="flex-1">
                    Viewing <b>{impersonating.gymName}</b> as a super-admin. Actions are recorded in the audit log.
                  </span>
                  <form action={impersonating.exit}>
                    <Button size="xs" variant="outline" type="submit">
                      <X /> Exit
                    </Button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <main id="main" className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-7 print:max-w-none print:p-0">
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}

function MobileTopBar({ name, logoUrl, color, onMenu }: { name: string; logoUrl?: string | null; color?: string | null; onMenu: () => void }) {
  const palette = useCommandPalette();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-canvas/80 px-3 backdrop-blur-xl lg:hidden print:hidden">
      <button type="button" aria-label="Open menu" onClick={onMenu} className="anim-host grid size-10 place-items-center rounded-xl hover:bg-muted">
        <AnimatedIcon icon={Menu} className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BrandMark name={name} logoUrl={logoUrl} color={color} size={26} />
        <span className="truncate text-sm font-semibold">{name}</span>
      </div>
      <button
        type="button"
        aria-label="Search"
        onClick={() => palette.setOpen(true)}
        className="anim-host grid size-10 place-items-center rounded-xl hover:bg-muted"
      >
        <AnimatedIcon icon={Search} className="size-5" />
      </button>
    </header>
  );
}
