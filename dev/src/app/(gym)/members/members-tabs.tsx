"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ScanFace, Users } from "@/components/icons";
import { AnimatedIcon } from "@/components/kit/animated-icon";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/members", label: "All members", icon: Users },
  { href: "/members/face-ids", label: "Face IDs", icon: ScanFace },
] as const;

/** Members ↔ Face IDs, as real pages (each has its own URL). */
export function MembersTabs({ faceCount }: { faceCount?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Members sections" data-tour="members-tabs" className="-mx-1 mb-5 no-scrollbar flex gap-1 overflow-x-auto border-b px-1">
      {TABS.map((t) => {
        const active = t.href === "/members" ? path === "/members" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "anim-host relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <AnimatedIcon icon={t.icon} className="size-4" />
            {t.label}
            {t.href === "/members/face-ids" && !!faceCount && (
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{faceCount}</span>
            )}
            {active && (
              <motion.span
                layoutId="members-tabs"
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
