import { ShieldQuestion } from "lucide-react";

export const metadata = { title: "No gym yet" };

export default function NoAccess() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="surface max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-info-soft text-info-ink">
          <ShieldQuestion className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">You&apos;re not part of a gym yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask your gym owner to add you under Staff, or contact AvniX to set up your gym.</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="h-10 w-full rounded-[10px] border text-sm font-medium hover:bg-muted">Sign out</button>
        </form>
      </div>
    </main>
  );
}
