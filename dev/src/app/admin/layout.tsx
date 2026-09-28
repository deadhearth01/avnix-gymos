import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { Preloader } from "@/components/brand/preloader";
import { requireSuperAdmin } from "@/lib/auth/session";
import { searchGymsAction } from "./actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireSuperAdmin();
  const collapsed = (await cookies()).get("gymos_sidebar")?.value === "1";
  return (
    <AppShell
      variant="admin"
      brand={{ name: "AvniX GymOS", subtitle: "Super admin console", gymos: true }}
      user={{ name: user.name, email: user.email }}
      superAdmin
      initialCollapsed={collapsed}
      search={searchGymsAction}
    >
      <Preloader />
      {children}
    </AppShell>
  );
}
