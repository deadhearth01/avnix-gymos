import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { GYM_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import { sessionClient } from "@/lib/appwrite/server";

async function signOut(req: NextRequest) {
  const jar = await cookies();
  const secret = jar.get(SESSION_COOKIE)?.value;
  if (secret)
    await sessionClient(secret)
      .account.deleteSession({ sessionId: "current" })
      .catch(() => {});
  jar.delete(SESSION_COOKIE);
  jar.delete(GYM_COOKIE);
  const reason = req.nextUrl.searchParams.get("reason");
  const url = new URL(`/login${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, req.url);
  return NextResponse.redirect(url, { status: 303 });
}

/** GET is only honoured for server-initiated sign-outs (expired session). */
export async function GET(req: NextRequest) {
  // Only clears a cookie whose session is already dead, so a third-party link can't sign you out.
  const jar = await cookies();
  const secret = jar.get(SESSION_COOKIE)?.value;
  if (secret) {
    const alive = await sessionClient(secret)
      .account.get()
      .then(
        () => true,
        () => false,
      );
    if (alive) return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(GYM_COOKIE);
  return NextResponse.redirect(new URL("/login?reason=expired", req.url), { status: 303 });
}
export const POST = signOut;
