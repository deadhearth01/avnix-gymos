import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Query } from "node-appwrite";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { getGymContext } from "@/lib/auth/session";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { repo } from "@/lib/data/repo";
import { mediaUrl } from "@/lib/media";
import { brandThemeCss } from "@/lib/brand-theme";
import { Preloader } from "@/components/brand/preloader";
import { OnboardingTour } from "@/components/shell/onboarding-tour";
import type { Gym } from "@/lib/types";
import { exitImpersonationAction, markTourSeenAction, realtimeTokenAction, searchAction, switchGymAction } from "./_actions/common";

export default async function GymLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getGymContext();
  // Owners created with "owner onboarding" finish the guided setup before using the workspace.
  if ((ctx.user.prefs as { onboardingGymId?: string })?.onboardingGymId === ctx.gymId && ctx.role === "owner" && !ctx.impersonating) redirect("/onboarding");
  const r = repo(ctx.gymId);
  const now = new Date().toISOString();
  const [collapsed, members, leads, outbox, gyms] = await Promise.all([
    cookies().then((c) => c.get("gymos_sidebar")?.value === "1"),
    r.count(T.members, [Query.equal("status", "active"), Query.greaterThanEqual("expiresAt", now)]),
    r.count(T.leads, [Query.equal("status", ["new", "contacted", "trial_booked", "trial_done"])]),
    r.count(T.messages, [Query.equal("status", "queued")]),
    ctx.memberships.length > 1
      ? adminClient()
          .tables.listRows<Gym>({
            databaseId: DB_ID,
            tableId: T.gyms,
            queries: [
              Query.equal(
                "$id",
                ctx.memberships.map((m) => m.gymId),
              ),
              Query.select(["$id", "name"]),
            ],
          })
          .then((x) => x.rows)
      : Promise.resolve([] as Gym[]),
  ]);
  const prefs = (ctx.user.prefs ?? {}) as { mustChangePassword?: boolean; tours?: unknown };
  const mustChange = !!prefs.mustChangePassword && !ctx.impersonating;
  const toursSeen = Array.isArray(prefs.tours) ? prefs.tours.filter((t): t is string => typeof t === "string") : [];

  return (
    <AppShell
      variant="gym"
      role={ctx.role}
      brand={{
        name: ctx.gym.name,
        subtitle: ctx.impersonating ? "Super-admin view" : (ctx.gym.city ?? "Your gym"),
        logoUrl: mediaUrl(ctx.gym.logoFileId, { width: 96, height: 96 }),
        color: ctx.gym.brandColor,
      }}
      counts={{ members, leads, outbox }}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      switcher={gyms.map((g) => ({ id: g.$id, name: g.name, active: g.$id === ctx.gymId }))}
      switchGym={switchGymAction}
      superAdmin={ctx.superAdmin}
      impersonating={ctx.impersonating ? { gymName: ctx.gym.name, exit: exitImpersonationAction } : null}
      search={searchAction}
      initialCollapsed={collapsed}
    >
      {/* gym brand colour → whole workspace (validated hex only) */}
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(ctx.gym.brandColor) }} />
      <Preloader />
      <OnboardingTour seen={toursSeen} enabled={!ctx.impersonating} markSeen={markTourSeenAction} />
      <RealtimeProvider getToken={realtimeTokenAction}>
        {mustChange && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-success-soft/50 p-4 sm:flex-row sm:items-center print:hidden">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Set your own password</p>
              <p className="text-sm text-muted-foreground">You&apos;re using a one-time password. Choose a personal one to keep your gym secure.</p>
            </div>
            <Link
              href="/settings?tab=security"
              className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3.5 text-sm font-medium text-primary-foreground"
            >
              Change password
            </Link>
          </div>
        )}
        {children}
      </RealtimeProvider>
    </AppShell>
  );
}
