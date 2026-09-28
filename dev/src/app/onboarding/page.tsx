import { redirect } from "next/navigation";
import { Query } from "node-appwrite";
import { T } from "@/lib/appwrite/schema";
import { getGymContext } from "@/lib/auth/session";
import { repo } from "@/lib/data/repo";
import type { GymSite, Plan } from "@/lib/types";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Set up your gym" };

export default async function OnboardingPage() {
  const ctx = await getGymContext();
  const prefs = (ctx.user.prefs ?? {}) as { onboardingGymId?: string; mustChangePassword?: boolean };
  if (ctx.impersonating || prefs.onboardingGymId !== ctx.gymId || ctx.role !== "owner") redirect("/dashboard");
  let site: GymSite = {};
  try {
    site = ctx.gym.site ? (JSON.parse(ctx.gym.site) as GymSite) : {};
  } catch {
    /* defaults below */
  }
  const plans = (await repo(ctx.gymId).list<Plan>(T.plans, [Query.orderAsc("sortOrder"), Query.limit(50)], false)).rows;
  return (
    <OnboardingWizard
      ownerName={ctx.user.name}
      mustChangePassword={!!prefs.mustChangePassword}
      initial={{
        gym: {
          name: ctx.gym.name,
          city: ctx.gym.city ?? "",
          address: ctx.gym.address ?? "",
          phone: ctx.gym.phone ?? "",
          gstin: ctx.gym.gstin ?? "",
          brandColor: ctx.gym.brandColor ?? "#16a34a",
        },
        plans: plans.map((p) => ({
          id: p.$id,
          name: p.name,
          type: p.type,
          durationDays: p.durationDays,
          sessions: p.sessions,
          price: p.price,
          active: p.active,
        })),
        site: {
          tagline: site.tagline ?? "",
          heroText: site.heroText ?? "",
          hours: site.hours?.length ? site.hours : [{ days: "Mon – Sat", open: "05:00", close: "22:00" }],
          showPrices: site.showPrices !== false,
          showTrial: site.showTrial !== false,
        },
      }}
      slug={ctx.gym.slug}
      rootDomain={process.env.ROOT_DOMAIN || "gym.avnix.in"}
    />
  );
}
