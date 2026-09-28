import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ForbiddenError } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/data/repo";
import type { ActionResult } from "@/lib/types";

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/** Runs an action body and maps every failure to a safe, human message. */
export async function safe<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const i of e.issues) (fieldErrors[i.path.join(".")] ??= []).push(i.message);
      return { ok: false, error: e.issues[0]?.message ?? "Please check the form.", fieldErrors };
    }
    if (e instanceof ForbiddenError || e instanceof UserError || e instanceof NotFoundError) return { ok: false, error: e.message };
    const ae = e as { code?: number; type?: string; message?: string };
    if (ae?.code === 409) return { ok: false, error: "That already exists." };
    if (ae?.code === 404) return { ok: false, error: "Not found — it may have been removed." };
    if (typeof ae?.code === "number" && ae.code >= 400 && ae.code < 500 && ae.message) return { ok: false, error: ae.message };
    if (e instanceof Error && /Subdomain|already taken|valid domain|Twilio|configured|domain/i.test(e.message)) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export const zMoney = z.coerce
  .number()
  .min(0, "Can't be negative")
  .max(10_000_000)
  .transform((n) => Math.round(n * 100) / 100);
export const zOptStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
