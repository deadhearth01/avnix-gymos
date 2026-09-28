import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "AvniX GymOS — Put the register down.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function bricolage(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&text=${encodeURIComponent(text)}`)).text();
    const src = /src: url\((.+?)\) format\('(opentype|truetype)'\)/.exec(css)?.[1];
    return src ? await (await fetch(src)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const headline = "Put the register down.";
  const sub = "Gym software for Indian gyms · AvniX GymOS";
  const [font, doodle] = await Promise.all([
    bricolage(headline + sub),
    readFile(join(process.cwd(), "public/brand/og-doodle.jpg"))
      .then((b) => `data:image/jpeg;base64,${b.toString("base64")}`)
      .catch(() => null),
  ]);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#ffffff", color: "#1e1f24", padding: "0 64px" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 520, gap: 26 }}>
        <div style={{ fontFamily: font ? "Bricolage" : "sans-serif", fontSize: 96, lineHeight: 0.98, letterSpacing: -3 }}>{headline}</div>
        <div style={{ fontFamily: font ? "Bricolage" : "sans-serif", fontSize: 28, color: "#5d5f68" }}>{sub}</div>
      </div>
      {doodle && <img src={doodle} alt="" width={600} height={400} style={{ marginLeft: 16 }} />}
    </div>,
    { ...size, fonts: font ? [{ name: "Bricolage", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
