import { deviceFor, text } from "@/lib/devices/zkteco";

export const dynamic = "force-dynamic";

/** Command results (ID=…&Return=…&CMD=…). */
export async function POST(req: Request) {
  await deviceFor(req);
  return text("OK");
}
