import { deviceFor, options, text } from "@/lib/devices/zkteco";

export const dynamic = "force-dynamic";

/** Push protocol 3.x: configuration download after registration. */
export async function GET(req: Request) {
  const found = await deviceFor(req);
  return text(found ? options(found.sn) : "OK");
}
export const POST = GET;
