"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/kit/animated-icon";

export function ErrorView({ error, reset, home = "/dashboard" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="surface max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger-ink">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This part of the page couldn&apos;t load. Your data is safe — try again, and if it keeps happening, contact AvniX support.
        </p>
        {error.digest && <p className="mt-3 font-mono text-[11px] text-subtle">Ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link href={home}>Go home</Link>
          </Button>
          <Button onClick={reset}>
            <AnimatedIcon icon={RotateCw} /> Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
