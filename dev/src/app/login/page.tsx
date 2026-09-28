import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Preloader } from "@/components/brand/preloader";
import { LoginForm } from "./login-form";
import { AuthShowcase } from "./showcase";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Preloader />
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" aria-label="GymOS home" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <LoginForm next={next} reason={reason} />
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AvniX · Secure sign-in · Data hosted in India</p>
      </div>
      <AuthShowcase />
    </div>
  );
}
