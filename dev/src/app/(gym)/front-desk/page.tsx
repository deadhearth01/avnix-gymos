import { Query } from "node-appwrite";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data/repo";
import { T } from "@/lib/appwrite/schema";
import { dayKey } from "@/lib/domain/membership";
import type { Checkin } from "@/lib/types";
import { FrontDesk } from "./front-desk";

export const metadata = { title: "Front desk" };

export default async function FrontDeskPage({ searchParams }: PageProps<"/front-desk">) {
  const sp = await searchParams;
  const ctx = await requireCap("checkins.create");
  const today = await repo(ctx.gymId).list<Checkin>(T.checkins, [Query.equal("dayKey", dayKey()), Query.orderDesc("at"), Query.limit(300)], true);
  return (
    <FrontDesk
      gymName={ctx.gym.name}
      today={today.rows.map((c) => ({ id: c.$id, memberId: c.memberId, name: c.memberName, at: c.at, method: c.method, by: c.by }))}
      todayKey={dayKey()}
      initialTab={typeof sp.tab === "string" ? sp.tab : "desk"}
      total={today.total}
    />
  );
}
