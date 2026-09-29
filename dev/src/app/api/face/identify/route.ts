import { NextResponse } from "next/server";
import { identifyFaceAction } from "@/app/(gym)/_actions/devices";

export const dynamic = "force-dynamic";

/** Face kiosk recognition (runs many times a minute — kept off the server-action queue). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { readings?: unknown } | null;
  if (!Array.isArray(body?.readings)) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json(await identifyFaceAction(body.readings as number[][]));
  } catch {
    return NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
  }
}
