import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/data/rate-limit";
import { ipOf } from "@/lib/devices/zkteco";
import { findDevice, recordPunch, touchDevice } from "@/lib/services/attendance";

export const dynamic = "force-dynamic";

const punch = z.object({
  userId: z.string().trim().min(1).max(32),
  at: z.iso.datetime({ offset: true }).optional(),
  method: z.enum(["fingerprint", "face", "card", "biometric"]).default("biometric"),
});
const body = z.union([punch, z.object({ punches: z.array(punch).min(1).max(500) })]);

/**
 * Generic device webhook — any vendor, the GymOS Bridge or a script.
 *   POST /api/devices/punch   Authorization: Bearer gdv_…
 *   { "userId": "140", "at": "2026-09-28T06:31:00+05:30", "method": "fingerprint" }   or   { "punches": [ … ] }
 */
export async function POST(req: Request) {
  const token =
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? "";
  if (!/^gdv_[\w-]{20,64}$/.test(token)) return NextResponse.json({ error: "Missing or malformed device token" }, { status: 401 });
  if (!(await rateLimit(`dev:${token.slice(-12)}`, 600, 60))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const found = await findDevice({ token });
  if (!found) return NextResponse.json({ error: "Unknown or disabled device" }, { status: 401 });
  await touchDevice(found.device, ipOf(req));
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  const list = "punches" in parsed.data ? parsed.data.punches : [parsed.data];
  const results = [];
  for (const p of list) {
    const result = await recordPunch({ gym: found.gym, device: found.device, userId: p.userId, at: p.at ? new Date(p.at) : new Date(), method: p.method });
    results.push({ userId: p.userId, result });
  }
  return NextResponse.json({ ok: true, results });
}
