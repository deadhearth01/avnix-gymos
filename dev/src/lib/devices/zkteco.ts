import "server-only";

import { createHash } from "node:crypto";
import { rateLimit } from "@/lib/data/rate-limit";
import { findDevice, recordPunch, touchDevice } from "@/lib/services/attendance";
import type { Checkin } from "@/lib/types";

/**
 * ZKTeco "ADMS" / PUSH protocol (also eSSL, Realtime, Identix, BioMax — all ZKTeco firmware).
 * The protocol has no authentication: only serial numbers registered in GymOS are served,
 * unknown devices get a bare "OK" and nothing is stored.
 */

export const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export function ipOf(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "").trim() || null;
}

export async function deviceFor(req: Request) {
  const sn = new URL(req.url).searchParams.get("SN")?.trim();
  if (!sn || !/^[\w.-]{3,64}$/.test(sn)) return null;
  if (!(await rateLimit(`zk:${sn}`, 900, 60))) return null;
  const found = await findDevice({ serial: sn });
  if (found) await touchDevice(found.device, ipOf(req));
  return found ? { ...found, sn } : null;
}

/** Handshake options: realtime upload of attendance logs, IST clock. */
export function options(sn: string) {
  return [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog",
    "TimeZone=5.5",
    "Realtime=1",
    "Encrypt=None",
    "ServerVer=2.4.1",
    "PushProtVer=2.4.1",
  ].join("\n");
}

export const registryCode = (sn: string) => createHash("sha256").update(`gymos:${sn}`).digest("hex").slice(0, 10);

/** Verify mode → GymOS check-in method. */
function methodOf(verify: number): Checkin["method"] {
  if (verify === 15) return "face";
  if ([1, 5, 6, 8].includes(verify)) return "fingerprint";
  if ([2, 4, 7].includes(verify)) return "card";
  return "biometric";
}

/** "2026-09-28 06:31:05" in the device's local time (IST), or unix seconds. */
function parseTime(v: string) {
  if (/^\d{9,11}$/.test(v)) return new Date(Number(v) * 1000);
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(v.trim());
  return m ? new Date(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}+05:30`) : new Date(NaN);
}

/** `PIN \t time \t status \t verify \t workcode …` per line. */
export async function ingestAttlog(found: NonNullable<Awaited<ReturnType<typeof deviceFor>>>, body: string) {
  const lines = body.split(/\r?\n/).filter(Boolean).slice(0, 500);
  let n = 0;
  for (const line of lines) {
    const [pin, time, , verify] = line.split("\t");
    if (!pin || !time) continue;
    await recordPunch({ gym: found.gym, device: found.device, userId: pin.trim(), at: parseTime(time), method: methodOf(Number(verify)) });
    n++;
  }
  return n;
}
