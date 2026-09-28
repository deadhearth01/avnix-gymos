import Link from "next/link";
import { Compass } from "@/components/icons";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <p className="bg-gradient-to-b from-foreground to-foreground/30 bg-clip-text text-8xl font-semibold tracking-tighter text-transparent">404</p>
        <span className="mx-auto mt-6 grid size-11 place-items-center rounded-2xl border bg-card text-primary shadow-[var(--shadow-float)]">
          <Compass className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">This page took a rest day</h1>
        <p className="mt-1 text-sm text-muted-foreground">The link may be old, or the record was removed.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground">
          Back to GymOS
        </Link>
      </div>
    </main>
  );
}
