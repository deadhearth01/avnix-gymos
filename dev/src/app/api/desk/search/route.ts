import { NextResponse } from "next/server";
import { deskSearchAction } from "@/app/(gym)/_actions/frontdesk";

export const dynamic = "force-dynamic";

/**
 * Front-desk search as a plain GET so the browser can cancel superseded requests
 * (server actions run one at a time, which made fast typing lag behind).
 * Auth + capability checks live in deskSearchAction.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ q, hits: await deskSearchAction(q) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const digest = (e as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return NextResponse.json({ error: "Signed out" }, { status: 401 });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
