import { deviceFor, ingestAttlog, options, text } from "@/lib/devices/zkteco";

export const dynamic = "force-dynamic";

/** Handshake: device asks for its options. */
export async function GET(req: Request) {
  const found = await deviceFor(req);
  return text(found ? options(found.sn) : "OK");
}

/** Uploads: ATTLOG (punches) is processed; everything else (OPERLOG, USERINFO, photos…) is acknowledged. */
export async function POST(req: Request) {
  const found = await deviceFor(req);
  const body = (await req.text()).slice(0, 200_000);
  if (!found) return text("OK");
  const table = new URL(req.url).searchParams.get("table")?.toUpperCase();
  if (table === "ATTLOG") return text(`OK: ${await ingestAttlog(found, body)}`);
  const lines = body.split(/\r?\n/).filter(Boolean).length;
  return text(`OK: ${lines}`);
}
