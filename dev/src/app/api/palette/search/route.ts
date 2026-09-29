import { NextResponse } from "next/server";
import { searchAction } from "@/app/(gym)/_actions/common";

export const dynamic = "force-dynamic";

/** Command-palette people search as a GET (cancellable, off the server-action queue). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 64) ?? "";
  try {
    return NextResponse.json(q.trim().length >= 2 ? await searchAction(q) : [], { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json([], { status: 401 });
  }
}
