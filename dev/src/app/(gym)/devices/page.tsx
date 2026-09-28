import { Query } from "node-appwrite";
import { T } from "@/lib/appwrite/schema";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data/repo";
import type { Device, Punch } from "@/lib/types";
import { DevicesView } from "./devices-view";

export const metadata = { title: "Attendance devices" };

export default async function DevicesPage() {
  const ctx = await requireCap("devices.manage");
  const r = repo(ctx.gymId);
  const [devices, punches, faces] = await Promise.all([
    r.list<Device>(T.devices, [Query.orderAsc("$createdAt"), Query.limit(50)], false),
    r.list<Punch>(T.punches, [Query.orderDesc("at"), Query.limit(40)], false),
    r.count(T.faceProfiles),
  ]);
  const root = process.env.ROOT_DOMAIN || "gym.avnix.in";
  return (
    <DevicesView
      root={root}
      facesEnrolled={faces}
      devices={devices.rows.map((d) => ({
        id: d.$id,
        name: d.name,
        vendor: d.vendor,
        serial: d.serial,
        enabled: d.enabled,
        lastSeenAt: d.lastSeenAt,
        lastPunchAt: d.lastPunchAt,
        lastIp: d.lastIp,
        punchCount: d.punchCount,
        model: (() => {
          try {
            const info = d.info ? (JSON.parse(d.info) as Record<string, string>) : {};
            return info.DeviceName ?? null;
          } catch {
            return null;
          }
        })(),
      }))}
      punches={punches.rows.map((p) => ({
        id: p.$id,
        deviceName: p.deviceName,
        userId: p.userId,
        at: p.at,
        method: p.method,
        result: p.result,
        memberId: p.memberId,
        memberName: p.memberName,
        note: p.note,
      }))}
    />
  );
}
