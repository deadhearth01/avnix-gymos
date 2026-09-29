import { NextResponse } from "next/server";
import { markTourSeenAction } from "@/app/(gym)/_actions/common";

export const dynamic = "force-dynamic";

/** Remember a finished guide chapter — fire-and-forget from the browser, off the server-action queue. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  if (typeof body?.key !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await markTourSeenAction(body.key);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
