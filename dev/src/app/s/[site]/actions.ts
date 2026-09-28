"use server";

import { Query } from "node-appwrite";
import { z } from "zod";
import { T } from "@/lib/appwrite/schema";
import { clientIp } from "@/lib/auth/session";
import { rateLimit } from "@/lib/data/rate-limit";
import { repo } from "@/lib/data/repo";
import { bumpStat } from "@/lib/data/stats";
import { toE164 } from "@/lib/format";
import { resolveSite } from "@/lib/queries/site";
import type { ActionResult, Lead } from "@/lib/types";

const schema = z.object({
  site: z.string().min(1).max(260),
  name: z.string().trim().min(2, "Enter your name").max(128),
  phone: z
    .string()
    .trim()
    .refine((value) => /^\+91[6-9]\d{9}$/.test(toE164(value) ?? ""), "Enter a valid Indian mobile number"),
  goal: z.enum(["Weight loss", "Muscle gain", "General fitness", "Strength", "Sports", "Other"]),
  trialAt: z.iso.datetime({ local: true, precision: -1 }).optional(),
  company: z.string().max(200).optional(),
  consent: z.literal("on", { error: "Consent is required" }),
});

export async function submitSiteLead(formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({
    site: formData.get("site"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    goal: formData.get("goal"),
    trialAt: formData.get("trialAt") || undefined,
    company: formData.get("company") || undefined,
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (parsed.data.company) return { ok: true, message: "Thank you. We will be in touch soon." };

  const phone = toE164(parsed.data.phone);
  if (!phone) return { ok: false, error: "Enter a valid Indian mobile number." };
  let trialAt: string | null = null;
  if (parsed.data.trialAt) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(parsed.data.trialAt)) return { ok: false, error: "Choose a valid trial date and time." };
    const date = new Date(`${parsed.data.trialAt}+05:30`);
    if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now()) return { ok: false, error: "Choose a future trial date and time." };
    trialAt = date.toISOString();
  }

  try {
    const gym = await resolveSite(parsed.data.site);
    if (!gym || gym.status !== "active" || gym.siteEnabled === false) return { ok: false, error: "This site is temporarily unavailable." };
    const ip = await clientIp();
    const ipAllowed = await rateLimit(`site-lead:ip:${gym.$id}:${ip || "unknown"}`, 5, 600, { failClosed: true });
    if (!ipAllowed) return { ok: false, error: "Too many requests. Please try again later." };
    const phoneAllowed = await rateLimit(`site-lead:phone:${gym.$id}:${phone}`, 3, 86400, { failClosed: true });
    if (!phoneAllowed) return { ok: false, error: "Too many requests. Please try again later." };

    const data = repo(gym.$id);
    const existing = await data.list<Lead>(
      T.leads,
      [Query.equal("phone", phone), Query.notEqual("status", "joined"), Query.notEqual("status", "lost"), Query.limit(1)],
      false,
    );
    const note = `Website enquiry · ${parsed.data.goal}${trialAt ? ` · Trial requested ${trialAt}` : ""} · ${new Date().toISOString()}`;
    if (existing.rows[0]) {
      const lead = existing.rows[0];
      await data.update(T.leads, lead.$id, {
        notes: [lead.notes?.slice(-3000), note].filter(Boolean).join("\n"),
        ...(trialAt ? { trialAt, status: "trial_booked" } : {}),
      });
    } else {
      await data.create(T.leads, {
        name: parsed.data.name,
        phone,
        source: "website",
        goal: parsed.data.goal,
        status: trialAt ? "trial_booked" : "new",
        trialAt,
        notes: note,
      });
      await bumpStat(gym.$id, { leads: 1 });
    }
    return { ok: true, message: "You're on the list. The team will contact you soon." };
  } catch {
    return { ok: false, error: "We could not send your request. Please try again." };
  }
}
