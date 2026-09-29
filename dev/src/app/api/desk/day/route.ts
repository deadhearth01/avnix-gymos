import { NextResponse } from "next/server";
import { deskDayAction } from "@/app/(gym)/_actions/frontdesk";

export const dynamic = "force-dynamic";

/** One day's check-ins as a GET (used to refresh the desk without queueing behind the user's saves). */
export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day") ?? "";
  try {
    return NextResponse.json(await deskDayAction(day), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 401 });
  }
}
