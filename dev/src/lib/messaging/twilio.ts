import "server-only";
import { env } from "@/lib/env";

/**
 * Twilio Programmable Messaging under the master AvniX account.
 * Each gym owns a sender: an SMS Messaging Service SID and a WhatsApp sender
 * (either a WhatsApp-enabled Messaging Service SID or an approved number).
 */

export type GymSender = {
  twilioSmsServiceSid?: string | null;
  twilioWhatsappFrom?: string | null;
  twilioWhatsappServiceSid?: string | null;
};

export function isTwilioReady() {
  const e = env();
  return Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN);
}

function auth() {
  const e = env();
  return "Basic " + Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
}

export class TwilioError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: number,
  ) {
    super(message);
    this.name = "TwilioError";
  }
}

export async function sendTwilioMessage({
  channel,
  to,
  body,
  sender,
  contentSid,
  contentVariables,
  statusCallback,
}: {
  channel: "sms" | "whatsapp";
  to: string; // E.164
  body: string;
  sender: GymSender;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  statusCallback?: string;
}): Promise<{ sid: string; status: string }> {
  if (!isTwilioReady()) throw new TwilioError("Twilio is not configured on the server.");
  const e = env();
  const params = new URLSearchParams();

  if (channel === "whatsapp") {
    params.set("To", `whatsapp:${to}`);
    if (sender.twilioWhatsappServiceSid) params.set("MessagingServiceSid", sender.twilioWhatsappServiceSid);
    else if (sender.twilioWhatsappFrom) params.set("From", `whatsapp:${sender.twilioWhatsappFrom.replace(/^whatsapp:/, "")}`);
    else throw new TwilioError("This gym has no WhatsApp sender configured.");
  } else {
    params.set("To", to);
    if (sender.twilioSmsServiceSid) params.set("MessagingServiceSid", sender.twilioSmsServiceSid);
    else throw new TwilioError("This gym has no SMS Messaging Service configured.");
  }

  if (contentSid) {
    params.set("ContentSid", contentSid);
    if (contentVariables) params.set("ContentVariables", JSON.stringify(contentVariables));
  } else {
    params.set("Body", body.slice(0, 1600));
  }
  if (statusCallback) params.set("StatusCallback", statusCallback);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string; code?: number };
  if (!res.ok || !data.sid) throw new TwilioError(data.message || `Twilio error ${res.status}`, data.code, res.status);
  return { sid: data.sid, status: data.status ?? "queued" };
}

/** Validate a Messaging Service SID exists on the master account (admin UX). */
export async function lookupMessagingService(sid: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!isTwilioReady()) return { ok: false, error: "Twilio not configured" };
  if (!/^MG[0-9a-f]{32}$/i.test(sid)) return { ok: false, error: "A Messaging Service SID starts with MG and has 34 characters." };
  const res = await fetch(`https://messaging.twilio.com/v1/Services/${sid}`, { headers: { Authorization: auth() }, cache: "no-store" });
  if (res.status === 404) return { ok: false, error: "No such Messaging Service on the AvniX Twilio account." };
  if (!res.ok) return { ok: false, error: `Twilio error ${res.status}` };
  const d = (await res.json()) as { friendly_name?: string };
  return { ok: true, name: d.friendly_name };
}

/** Twilio request signature check for status callbacks. */
export async function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null) {
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", env().TWILIO_AUTH_TOKEN).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
