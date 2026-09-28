import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { mediaUrl, parseSite, resolveSite, safeBrandColor } from "@/lib/queries/site";
import { isPreset } from "@/lib/site/presets";

export const alt = "Gym website preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Static extra-condensed Archivo cut for just the glyphs we draw (satori can't use variable fonts); the first face returned is the narrowest. */
async function archivo(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,800&text=${encodeURIComponent(text)}`, {
        signal: AbortSignal.timeout(4000),
      })
    ).text();
    const src = /src: url\((.+?)\) format\('(opentype|truetype)'\)/.exec(css)?.[1];
    return src ? await (await fetch(src, { signal: AbortSignal.timeout(4000) })).arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function background(heroFileId: string | undefined): Promise<string | null> {
  if (heroFileId && !isPreset(heroFileId)) {
    const url = mediaUrl(heroFileId, 1200)?.replace("output=webp", "output=jpg");
    if (url) return url;
  }
  const name = heroFileId === "preset:hero-ropes" ? "hero-ropes" : "hero-deadlift";
  try {
    const buf = await readFile(join(process.cwd(), "public/site-defaults/og", `${name}.jpg`));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({ params }: { params: Promise<{ site: string }> }) {
  const gym = await resolveSite((await params).site);
  if (!gym || gym.status !== "active" || gym.siteEnabled === false) notFound();
  const site = parseSite(gym);
  const brand = safeBrandColor(gym.brandColor) ?? "#16a34a";
  const headline = (site.tagline || "Train hard. Train right.").toUpperCase();
  const name = gym.name.toUpperCase();
  const subline = [gym.city ? `Gym in ${gym.city}` : "Gym", site.showTrial !== false ? "Free trial available" : null].filter(Boolean).join("  ·  ");
  const [font, bg] = await Promise.all([archivo(`${headline}${name}${subline}`), background(site.heroFileId)]);
  const display = font ? "Archivo" : "sans-serif";
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#1d1e23", color: "#fff" }}>
      {bg && <img src={bg} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          background: "linear-gradient(90deg, rgba(10,11,14,0.9) 0%, rgba(10,11,14,0.6) 50%, rgba(10,11,14,0.1) 100%)",
        }}
      />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: brand }} />
          <div style={{ fontFamily: display, fontSize: 34, letterSpacing: 0.5 }}>{name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760 }}>
          <div style={{ fontFamily: display, fontSize: 104, lineHeight: 0.92 }}>{headline}</div>
          <div style={{ fontFamily: display, fontSize: 32, color: "rgba(255,255,255,0.8)" }}>{subline}</div>
        </div>
      </div>
    </div>,
    { ...size, fonts: font ? [{ name: "Archivo", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
