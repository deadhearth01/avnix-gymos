/** One-off: refresh the demo gym's website content. `npx tsx --env-file=.env.local scripts/patch-demo-site.mts` */
import { Client, Query, TablesDB } from "node-appwrite";
import { DEMO_SITE } from "./demo-site.mjs";

const client = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const tables = new TablesDB(client);
const db = process.env.APPWRITE_DATABASE_ID || "gymos";
const { rows } = await tables.listRows({ databaseId: db, tableId: "gyms", queries: [Query.equal("slug", "ironparadise"), Query.limit(1)] });
if (!rows[0]) throw new Error("Demo gym not found");
await tables.updateRow({ databaseId: db, tableId: "gyms", rowId: rows[0].$id, data: { site: JSON.stringify(DEMO_SITE) } });
console.log("demo site updated", rows[0].$id);
