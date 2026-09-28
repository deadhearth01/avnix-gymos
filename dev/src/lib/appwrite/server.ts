import "server-only";
import { Account, Client, Proxy, Storage, TablesDB, Teams, Users, Sites } from "node-appwrite";
import { env } from "@/lib/env";

/** Privileged client (API key). Never expose to the browser. */
export function adminClient() {
  const e = env();
  const client = new Client().setEndpoint(e.APPWRITE_ENDPOINT).setProject(e.APPWRITE_PROJECT_ID).setKey(e.APPWRITE_API_KEY);
  return {
    client,
    account: new Account(client),
    tables: new TablesDB(client),
    users: new Users(client),
    teams: new Teams(client),
    storage: new Storage(client),
    proxy: new Proxy(client),
    sites: new Sites(client),
  };
}

/** Client acting as the signed-in user (session secret from our httpOnly cookie). */
export function sessionClient(secret: string, userAgent?: string) {
  const e = env();
  const client = new Client().setEndpoint(e.APPWRITE_ENDPOINT).setProject(e.APPWRITE_PROJECT_ID).setSession(secret);
  if (userAgent) client.setForwardedUserAgent(userAgent);
  return { client, account: new Account(client) };
}

export function isAppwriteError(e: unknown, code?: number): e is { code: number; type: string; message: string } {
  return typeof e === "object" && e !== null && "code" in e && (code === undefined || (e as { code: number }).code === code);
}
