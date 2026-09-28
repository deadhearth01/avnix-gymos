import "server-only";
import { z } from "zod";

const schema = z.object({
  APPWRITE_ENDPOINT: z.url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1, "APPWRITE_API_KEY is empty — add your server key to .env.local"),
  APPWRITE_DATABASE_ID: z.string().default("gymos"),
  APPWRITE_SITE_ID: z.string().default("gymos-web"),
  ROOT_DOMAIN: z.string().default("gym.avnix.in"),
  APP_URL: z.url().default("http://localhost:3000"),
  APP_SECRET: z.string().min(32),
  CRON_SECRET: z.string().optional().default(""),
  SUPER_ADMIN_EMAILS: z.string().default(""),
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional().default(""),
  TWILIO_EMAIL_FROM: z.string().optional().default(""),
  TWILIO_EMAIL_FROM_NAME: z.string().optional().default("GymOS"),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment → ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export const superAdminEmails = () =>
  env()
    .SUPER_ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
