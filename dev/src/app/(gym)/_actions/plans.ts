"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { safe, zMoney, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { repo } from "@/lib/data/repo";
import { PLAN_TYPES, T } from "@/lib/appwrite/schema";
import type { Plan } from "@/lib/types";

const planSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(128),
  type: z.enum(PLAN_TYPES),
  durationDays: z.coerce.number().int().min(1, "At least 1 day").max(1100),
  sessions: z.coerce.number().int().min(0).max(1000).default(0),
  price: zMoney,
  joiningFee: zMoney.default(0),
  description: zOptStr(500),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#16a34a"),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function savePlanAction(id: string | null, payload: z.input<typeof planSchema>) {
  return safe(
    async () => {
      const ctx = await requireCap("plans.manage");
      const d = planSchema.parse(payload);
      if (d.type !== "duration" && d.sessions < 1)
        throw new z.ZodError([{ code: "custom", path: ["sessions"], message: "Set the number of sessions", input: d.sessions }]);
      const r = repo(ctx.gymId);
      const data = { ...d, description: d.description ?? null, sessions: d.type === "duration" ? 0 : d.sessions };
      const plan = id ? await r.update<Plan>(T.plans, id, data) : await r.create<Plan>(T.plans, { ...data, active: true });
      await audit({
        gymId: ctx.gymId,
        actor: ctx.user,
        action: id ? "plan.update" : "plan.create",
        entity: "plan",
        entityId: plan.$id,
        summary: `${plan.name} ₹${plan.price}`,
      });
      revalidatePath("/plans");
      return { id: plan.$id };
    },
    id ? "Plan updated" : "Plan created",
  );
}

export async function setPlanActiveAction(id: string, active: boolean) {
  return safe(
    async () => {
      const ctx = await requireCap("plans.manage");
      const plan = await repo(ctx.gymId).update<Plan>(T.plans, id, { active });
      await audit({ gymId: ctx.gymId, actor: ctx.user, action: active ? "plan.restore" : "plan.archive", entity: "plan", entityId: id, summary: plan.name });
      revalidatePath("/plans");
    },
    active ? "Plan restored" : "Plan archived",
  );
}

/** Quick price edit from the website editor. */
export async function setPlanPriceAction(id: string, price: number) {
  return safe(async () => {
    const ctx = await requireCap("plans.manage");
    const value = zMoney.parse(price);
    const plan = await repo(ctx.gymId).update<Plan>(T.plans, id, { price: value });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "plan.update", entity: "plan", entityId: id, summary: `${plan.name} ₹${value}` });
    revalidatePath("/plans");
    revalidatePath("/website");
    revalidatePath(`/s/${ctx.gym.slug}`);
  }, "Price updated");
}
