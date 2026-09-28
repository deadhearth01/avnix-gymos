import { deviceFor, text } from "@/lib/devices/zkteco";

export const dynamic = "force-dynamic";

/** Heartbeat / command poll. No commands are queued yet. */
export async function GET(req: Request) {
  await deviceFor(req);
  return text("OK");
}
