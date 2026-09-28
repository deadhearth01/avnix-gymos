import "server-only";
import { env } from "@/lib/env";

/** Twilio Email API (comms.twilio.com) — same account as SMS, sender on avnix.in. */

const EMAIL_API = "https://comms.twilio.com/v1/Emails";

export function isEmailReady() {
  const e = env();
  return Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.TWILIO_EMAIL_FROM));
}

export async function sendEmail({
  to,
  toName,
  subject,
  html,
  text,
  tag,
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  tag?: string;
}) {
  if (!isEmailReady()) throw new Error("Email sending isn't configured (TWILIO_EMAIL_FROM).");
  const e = env();
  const auth = Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(EMAIL_API, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { address: e.TWILIO_EMAIL_FROM, name: e.TWILIO_EMAIL_FROM_NAME || "GymOS" },
      to: [{ address: to, ...(toName ? { name: toName } : {}) }],
      content: { subject, html, text },
      tags: { purpose: tag ?? "transactional" },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[]; message?: string };
    throw new Error(data.errors?.[0]?.message || data.message || `Twilio email error ${res.status}`);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Branded, table-based layout that renders in every mail client. */
export function emailLayout({
  preheader,
  heading,
  bodyHtml,
  cta,
}: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0b">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:30px;height:30px;border-radius:8px;background:#16a34a;color:#fff;font-weight:700;font-size:14px;text-align:center">G</td>
<td style="padding-left:10px;font-weight:600;font-size:15px">GymOS <span style="color:#71717a;font-weight:500;font-size:12px">by AvniX</span></td></tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #ececee;border-radius:20px;padding:32px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.02em">${esc(heading)}</h1>
${bodyHtml}
${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="border-radius:10px;background:#16a34a"><a href="${esc(cta.href)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none">${esc(cta.label)} →</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:16px 8px;color:#a1a1aa;font-size:12px;line-height:1.5">Sent by GymOS · AvniX, Visakhapatnam. If you weren't expecting this email you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
}

export function credentialsEmail({
  gymName,
  ownerName,
  email,
  password,
  loginUrl,
  siteUrl,
}: {
  gymName: string;
  ownerName: string;
  email: string;
  password: string;
  loginUrl: string;
  siteUrl: string;
}) {
  const row = (k: string, v: string, mono = false) =>
    `<tr><td style="padding:10px 14px;color:#71717a;font-size:13px;border-bottom:1px solid #f0f0f2;width:120px">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;border-bottom:1px solid #f0f0f2;${mono ? "font-family:JetBrains Mono,Menlo,monospace;font-weight:600;" : ""}">${esc(v)}</td></tr>`;
  const html = emailLayout({
    preheader: `Your ${gymName} dashboard is ready`,
    heading: `Welcome to GymOS, ${ownerName.split(" ")[0] || "there"} 👋`,
    bodyHtml: `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">Your dashboard for <b>${esc(gymName)}</b> is ready. Use the details below to sign in. For your security, change the password after your first sign-in.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececee;border-radius:12px;border-collapse:separate;overflow:hidden">
${row("Sign-in page", loginUrl)}${row("Email", email)}${row("Password", password, true)}${row("Your website", siteUrl)}
</table>`,
    cta: { label: "Open your dashboard", href: loginUrl },
  });
  const text = `Welcome to GymOS!\n\nYour dashboard for ${gymName} is ready.\n\nSign in: ${loginUrl}\nEmail: ${email}\nPassword: ${password}\nYour website: ${siteUrl}\n\nChange your password after your first sign-in.`;
  return { subject: `Your ${gymName} dashboard is ready`, html, text };
}
