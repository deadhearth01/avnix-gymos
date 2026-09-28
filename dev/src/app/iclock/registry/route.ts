import { touchDevice } from "@/lib/services/attendance";
import { deviceFor, registryCode, text } from "@/lib/devices/zkteco";

export const dynamic = "force-dynamic";

/** Push protocol 3.x registration: store the device's capability list, hand back a registry code. */
async function handle(req: Request) {
  const found = await deviceFor(req);
  if (!found) return text("RegistryCode=0");
  const body = req.method === "POST" ? (await req.text()).slice(0, 8000) : "";
  const info = Object.fromEntries(
    body
      .split(/[,\n]/)
      .map((kv) => kv.trim().replace(/^~/, "").split("="))
      .filter((kv) => kv.length === 2 && ["DeviceName", "FirmVer", "IPAddress", "DeviceType", "MAC", "UserCount", "FaceFunOn", "FingerFunOn"].includes(kv[0]))
      .map(([k, v]) => [k, v.slice(0, 80)]),
  );
  await touchDevice(found.device, null, info);
  return text(`RegistryCode=${registryCode(found.sn)}`);
}

export const GET = handle;
export const POST = handle;
