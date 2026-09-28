/** Dev only: mint a session for a user (by email) and print the cookie value to .dev/session. */
import { writeFileSync } from "node:fs";
import { Client, Users, Query } from "node-appwrite";
const c = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const users = new Users(c);
const email = process.argv[2];
const { users: found } = await users.list({ queries: [Query.equal("email", email)] });
if (!found[0]) throw new Error("no such user");
const s = await users.createSession({ userId: found[0].$id });
writeFileSync(".dev/session", s.secret, { mode: 0o600 });
console.log("session written for", email);
