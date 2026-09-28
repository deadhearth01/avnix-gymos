import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { parseSite, resolveSite, safeBrandColor } from "@/lib/queries/site";

export const alt = "Gym website preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OpenGraphImage({ params }: { params: Promise<{ site: string }> }) {
  const gym = await resolveSite((await params).site);
  if (!gym || gym.status !== "active" || gym.siteEnabled === false) notFound();
  const site = parseSite(gym);
  const brand = safeBrandColor(gym.brandColor) ?? "#16a34a";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#111416",
        color: "#ffffff",
        fontFamily: "sans-serif",
        backgroundImage: `radial-gradient(circle at 85% 20%, ${brand}66, transparent 40%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, fontWeight: 700 }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: brand }} />
        {gym.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ width: 120, height: 8, borderRadius: 4, background: brand }} />
        <div style={{ fontSize: 72, lineHeight: 1.05, fontWeight: 800, maxWidth: 950 }}>{site.tagline || `Find your stronger self at ${gym.name}`}</div>
        <div style={{ fontSize: 26, color: "#d4d4d8" }}>{gym.city ? `Train with us in ${gym.city}` : "Find your next level"}</div>
      </div>
    </div>,
    size,
  );
}
