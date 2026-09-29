import { NextResponse, type NextRequest } from "next/server";
import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DB_ID, T } from "@/lib/appwrite/schema";
import { env } from "@/lib/env";
import { invalidateGym } from "@/lib/data/cache";
import { verifyTwilioSignature } from "@/lib/messaging/twilio";

const MAP: Record<string, string> = {
  queued: "sending",
  sending: "sending",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  undelivered: "failed",
};

/** Twilio message status callbacks → message delivery status (signature verified). */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const url = `${env().APP_URL.replace(/\/$/, "")}/api/webhooks/twilio`;
  if (!(await verifyTwilioSignature(url, params, req.headers.get("x-twilio-signature")))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }
  const sid = params.MessageSid;
  const status = MAP[params.MessageStatus ?? ""];
  if (!sid || !status) return new NextResponse(null, { status: 204 });
  const { tables } = adminClient();
  const r = await tables.listRows({ databaseId: DB_ID, tableId: T.messages, queries: [Query.equal("providerId", sid), Query.limit(1)] });
  const row = r.rows[0] as unknown as { $id: string; status: string; gymId: string } | undefined;
  const RANK: Record<string, number> = { queued: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
  const regress = status !== "failed" && (RANK[row?.status ?? ""] ?? -1) >= (RANK[status] ?? 0);
  if (row && !regress && row.status !== "read") {
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: T.messages,
      rowId: row.$id,
      data: {
        status,
        ...(status === "failed" ? { error: `${params.ErrorCode ?? ""} ${params.ErrorMessage ?? "Delivery failed"}`.trim().slice(0, 1000) } : {}),
      },
    });
    invalidateGym(row.gymId);
  }
  return new NextResponse(null, { status: 204 });
}
