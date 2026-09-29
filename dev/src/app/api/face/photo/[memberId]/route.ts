import { Query } from "node-appwrite";
import { T } from "@/lib/appwrite/schema";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data/repo";
import { facePhoto } from "@/lib/services/attendance";
import type { FaceProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** A member's Face ID reference photo — staff of the same gym only (the bucket itself is private). */
export async function GET(_req: Request, ctx: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await ctx.params;
  try {
    const { gymId } = await requireCap("members.view");
    const row = (await repo(gymId).list<FaceProfile>(T.faceProfiles, [Query.equal("memberId", memberId), Query.select(["photoFileId"]), Query.limit(1)], false))
      .rows[0];
    if (!row?.photoFileId) return new Response(null, { status: 404 });
    const body = await facePhoto(row.photoFileId);
    return new Response(new Uint8Array(body), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 401 });
  }
}
