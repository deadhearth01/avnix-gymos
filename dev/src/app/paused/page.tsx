import { PauseCircle } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Access paused" };

export default async function Paused() {
  const s = await getSession();
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="surface max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning-ink">
          <PauseCircle className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Your gym&apos;s dashboard is paused</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access has been temporarily turned off. Your data and website are safe. Please contact AvniX to restore access.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href="mailto:support@avnix.in?subject=Restore%20GymOS%20access"
            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Contact AvniX support
          </a>
          {s && (
            <form action="/auth/signout" method="post">
              <button className="h-10 w-full rounded-[10px] text-sm text-muted-foreground hover:bg-muted">Sign out</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
