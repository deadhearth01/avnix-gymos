import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import { FadeIn } from "@/components/kit/motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <FadeIn className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[13px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="size-3.5 text-subtle" />}
                {c.href ? (
                  <Link href={c.href} className="rounded transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div data-tour="page-actions" className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </FadeIn>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
