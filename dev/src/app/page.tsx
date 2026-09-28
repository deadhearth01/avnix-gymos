import { redirect } from "next/navigation";
import { getSession, isSuperAdmin } from "@/lib/auth/session";

export default async function Root() {
  const s = await getSession();
  if (!s) redirect("/login");
  redirect(isSuperAdmin(s.user) ? "/admin" : "/dashboard");
}
