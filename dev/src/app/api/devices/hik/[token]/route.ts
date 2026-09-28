import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/data/rate-limit";
import { ipOf } from "@/lib/devices/zkteco";
import { findDevice, recordPunch, touchDevice } from "@/lib/services/attendance";
import type { Checkin } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Hikvision "pass" events: 1 = card, 38 = fingerprint, 75 = face (major 5 = access control). */
const PASS: Record<number, Checkin["method"]> = { 1: "card", 38: "fingerprint", 75: "face" };

type HikEvent = { employeeNo?: string; dateTime?: string; major?: number; minor?: number; verifyMode?: string };

function fromJson(v: unknown): HikEvent | null {
  if (!v || typeof v !== "object") return null;
  const root = v as Record<string, unknown>;
  const ev = (root.AccessControllerEvent ?? root) as Record<string, unknown>;
  const employeeNo = (ev.employeeNoString ?? ev.employeeNo) as string | number | undefined;
  return {
    employeeNo: employeeNo == null ? undefined : String(employeeNo),
    dateTime: (root.dateTime ?? ev.dateTime) as string | undefined,
    major: Number(ev.majorEventType ?? ev.major),
    minor: Number(ev.subEventType ?? ev.minor),
    verifyMode: ev.currentVerifyMode as string | undefined,
  };
}

function fromXml(xml: string): HikEvent | null {
  const tag = (t: string) => new RegExp(`<${t}>([^<]*)</${t}>`).exec(xml)?.[1];
  if (!xml.includes("AccessControllerEvent")) return null;
  return {
    employeeNo: tag("employeeNoString") ?? tag("employeeNo"),
    dateTime: tag("dateTime"),
    major: Number(tag("majorEventType") ?? tag("major")),
    minor: Number(tag("subEventType") ?? tag("minor")),
    verifyMode: tag("currentVerifyMode"),
  };
}

async function parse(req: Request): Promise<HikEvent | null> {
  const type = req.headers.get("content-type") ?? "";
  let payload = "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [, value] of form) {
      if (typeof value === "string" && value.includes("AccessControllerEvent")) {
        payload = value;
        break;
      }
    }
  } else payload = (await req.text()).slice(0, 100_000);
  if (!payload) return null;
  try {
    return fromJson(JSON.parse(payload));
  } catch {
    return fromXml(payload);
  }
}

/** HTTP listening host for Hikvision (and Hikvision-OEM) face / fingerprint terminals. The token in the URL is the credential. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^gdv_[\w-]{20,64}$/.test(token) || !(await rateLimit(`hik:${token.slice(-12)}`, 900, 60))) return new NextResponse("OK");
  const found = await findDevice({ token });
  if (!found) return new NextResponse("OK");
  await touchDevice(found.device, ipOf(req));
  const ev = await parse(req).catch(() => null);
  if (!ev?.employeeNo) return new NextResponse("OK"); // heartbeat or event without a person
  const method = PASS[ev.minor ?? -1] ?? (/face/i.test(ev.verifyMode ?? "") ? "face" : /fp|finger/i.test(ev.verifyMode ?? "") ? "fingerprint" : null);
  if (!method || (ev.major && ev.major !== 5)) return new NextResponse("OK"); // denied attempts, door alarms, etc.
  await recordPunch({ gym: found.gym, device: found.device, userId: ev.employeeNo, at: ev.dateTime ? new Date(ev.dateTime) : new Date(), method });
  return new NextResponse("OK");
}
