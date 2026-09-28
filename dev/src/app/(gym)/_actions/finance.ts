"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCap } from "@/lib/auth/session";
import { safe, zOptStr } from "@/lib/actions";
import { audit } from "@/lib/data/audit";
import { repo } from "@/lib/data/repo";
import { EXPENSE_CATS, T } from "@/lib/appwrite/schema";

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATS),
  amount: z.coerce.number().positive("Enter an amount").max(100_000_000),
  spentAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Pick a date"),
  vendor: zOptStr(128),
  note: zOptStr(500),
});

export async function createExpenseAction(payload: z.input<typeof expenseSchema>) {
  return safe(async () => {
    const ctx = await requireCap("finance.edit");
    const d = expenseSchema.parse(payload);
    const row = await repo(ctx.gymId).create(T.expenses, {
      ...d,
      spentAt: new Date(d.spentAt).toISOString(),
      vendor: d.vendor ?? null,
      note: d.note ?? null,
      recordedByName: ctx.user.name,
    });
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "expense.create", entity: "expense", entityId: row.$id, summary: `${d.category} ₹${d.amount}` });
    revalidatePath("/finance");
  }, "Expense added");
}

export async function deleteExpenseAction(id: string) {
  return safe(async () => {
    const ctx = await requireCap("finance.edit");
    await repo(ctx.gymId).remove(T.expenses, id);
    await audit({ gymId: ctx.gymId, actor: ctx.user, action: "expense.delete", entity: "expense", entityId: id });
    revalidatePath("/finance");
  }, "Expense removed");
}
