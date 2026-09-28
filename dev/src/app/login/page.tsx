import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { AuthShowcase } from "./showcase";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[9px] bg-primary text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
            G
          </span>
          <span className="text-[15px] font-semibold tracking-tight">GymOS</span>
          <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">by AvniX</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <LoginForm next={next} reason={reason} />
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AvniX · Secure sign-in · Data hosted in India</p>
      </div>
      <AuthShowcase />
    </div>
  );
}
