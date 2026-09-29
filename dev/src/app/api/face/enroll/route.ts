import { NextResponse } from "next/server";
import { deleteFaceAction, enrollFaceAction } from "@/app/(gym)/_actions/devices";

export const dynamic = "force-dynamic";

/**
 * Save / delete a member's Face ID. A plain request (not a server action) so it can be cancelled when
 * the dialog closes and never holds up navigation — server actions and page changes share one queue.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { memberId?: unknown; embeddings?: unknown; consent?: unknown; photo?: unknown } | null;
  if (!body || typeof body.memberId !== "string") return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json(await enrollFaceAction(body.memberId, body.embeddings as number[][], body.consent === true, body.photo));
  } catch {
    return NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  const memberId = new URL(req.url).searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json(await deleteFaceAction(memberId));
  } catch {
    return NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
  }
}
