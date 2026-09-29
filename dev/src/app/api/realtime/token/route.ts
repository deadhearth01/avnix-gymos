import { NextResponse } from "next/server";
import { realtimeTokenAction } from "@/app/(gym)/_actions/common";

export const dynamic = "force-dynamic";

/**
 * Realtime JWT as a plain GET: server actions run one at a time per tab, so fetching the token
 * through one used to hold up the user's own saves.
 */
export async function GET() {
  try {
    return NextResponse.json(await realtimeTokenAction(), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
