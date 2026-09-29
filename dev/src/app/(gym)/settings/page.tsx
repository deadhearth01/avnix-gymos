import { requireCap } from "@/lib/auth/session";
import { gymLogoUrl } from "@/lib/media";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const ctx = await requireCap("settings.manage");
  const query = await searchParams;
  return (
    <SettingsView
      initialTab={typeof query.tab === "string" ? query.tab : "profile"}
      gym={{
        name: ctx.gym.name,
        phone: ctx.gym.phone ?? "",
        email: ctx.gym.email ?? "",
        city: ctx.gym.city ?? "",
        address: ctx.gym.address ?? "",
        gstin: ctx.gym.gstin ?? "",
        gstRate: ctx.gym.gstRate ?? 5,
        gstInclusive: ctx.gym.gstInclusive,
        brandColor: ctx.gym.brandColor ?? "#16a34a",
        logoUrl: gymLogoUrl(ctx.gym, 128),
      }}
    />
  );
}
