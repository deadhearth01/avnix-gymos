import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/marketing/landing";
import { getSession, isSuperAdmin } from "@/lib/auth/session";

const TITLE = "AvniX GymOS — gym management software for Indian gyms";
const DESCRIPTION =
  "Members, QR check-in, GST billing, WhatsApp renewal reminders in Telugu and English, and a website for your gym. Made in Visakhapatnam for gyms across Andhra Pradesh.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://gym.avnix.in/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  keywords: [
    "gym management software",
    "gym software India",
    "gym software Visakhapatnam",
    "gym billing GST",
    "WhatsApp gym reminders",
    "fitness centre software",
  ],
  openGraph: { type: "website", url: "https://gym.avnix.in/", siteName: "AvniX GymOS", title: TITLE, description: DESCRIPTION, locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function Root() {
  const s = await getSession();
  if (s) redirect(isSuperAdmin(s.user) ? "/admin" : "/dashboard");
  return <Landing />;
}
