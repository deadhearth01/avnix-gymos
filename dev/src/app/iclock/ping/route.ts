import { deviceFor, text } from "@/lib/devices/zkteco";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await deviceFor(req);
  return text("OK");
}
