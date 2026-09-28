"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { SESSION_COOKIE, GYM_COOKIE } from "@/lib/auth/cookies";
import { clientIp } from "@/lib/auth/session";
import { rateLimit } from "@/lib/data/rate-limit";
import { superAdminEmails } from "@/lib/env";

const schema = z.object({
  email: z.email("Enter a valid email").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Password is at least 8 characters").max(256),
  next: z.string().optional(),
});

export type LoginState = { error?: string; fieldErrors?: Partial<Record<"email" | "password", string>>; email?: string };

function safeNext(n?: string) {
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null;
}

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password"), next: form.get("next") || undefined });
  if (!parsed.success) {
    const fe: LoginState["fieldErrors"] = {};
    for (const i of parsed.error.issues) fe[i.path[0] as "email" | "password"] ??= i.message;
    return { fieldErrors: fe, email: String(form.get("email") ?? "") };
  }
  const { email, password, next } = parsed.data;
  const ip = await clientIp();

  const [ipOk, emailOk] = await Promise.all([rateLimit(`login:ip:${ip}`, 30, 15 * 60), rateLimit(`login:email:${email}`, 8, 15 * 60)]);
  if (!ipOk || !emailOk) return { error: "Too many attempts. Please wait 15 minutes and try again.", email };

  const { account, users } = adminClient();
  let session;
  try {
    session = await account.createEmailPasswordSession({ email, password });
  } catch (e) {
    if (isAppwriteError(e, 401) || isAppwriteError(e, 400)) return { error: "That email and password don't match.", email };
    if (isAppwriteError(e, 429)) return { error: "Too many attempts. Please try again shortly.", email };
    console.error("[login]", e);
    return { error: "Sign-in is temporarily unavailable. Please try again.", email };
  }

  const user = await users.get({ userId: session.userId });
  if (!user.status) return { error: "This account is disabled. Contact your gym administrator.", email };

  const jar = await cookies();
  const h = await headers();
  const secure = (h.get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expire),
    priority: "high",
  });
  jar.delete(GYM_COOKIE);

  const isAdmin = user.labels?.includes("superadmin") && superAdminEmails().includes(user.email.toLowerCase());
  redirect(safeNext(next) ?? (isAdmin ? "/admin" : "/dashboard"));
}
