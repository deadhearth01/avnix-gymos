/**
 * Idempotent Appwrite provisioning for GymOS.
 *   npm run setup:appwrite
 *
 * - creates the database, every table (columns + indexes), storage buckets
 * - on re-runs, adds any missing columns/indexes (never drops data)
 * - ensures the super-admin account exists (label "superadmin"); a new
 *   account's one-time password is written to ./.superadmin-credentials
 */
import { writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { Client, TablesDB, Storage, Users, Sites, Proxy, ID, Query, Permission, Role, Compression, Framework, BuildRuntime, Adapter } from "node-appwrite";
import { BUCKETS, DB_ID, TABLES, type TableDef } from "../src/lib/appwrite/schema";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const client = new Client().setEndpoint(need("APPWRITE_ENDPOINT")).setProject(need("APPWRITE_PROJECT_ID")).setKey(need("APPWRITE_API_KEY"));
const db = new TablesDB(client);
const storage = new Storage(client);
const users = new Users(client);
const sites = new Sites(client);
const proxy = new Proxy(client);

const log = (...a: unknown[]) => console.log("•", ...a);
const isNotFound = (e: unknown) => (e as { code?: number })?.code === 404;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function colPayload(c: TableDef["columns"][number]) {
  const base: Record<string, unknown> = { key: c.key, type: c.type, required: c.required ?? false };
  if ("size" in c) base.size = c.size;
  if ("array" in c && c.array) base.array = true;
  if ("elements" in c) base.elements = c.elements;
  if ("min" in c && c.min !== undefined) base.min = c.min;
  if ("max" in c && c.max !== undefined) base.max = c.max;
  if ("default" in c && c.default !== undefined && !c.required) base.default = c.default;
  return base;
}

async function addColumn(tableId: string, c: TableDef["columns"][number]) {
  const common = { databaseId: DB_ID, tableId, key: c.key, required: c.required ?? false };
  const def = "default" in c && !c.required ? (c.default as never) : undefined;
  switch (c.type) {
    case "varchar":
      return db.createVarcharColumn({ ...common, size: c.size, xdefault: def, array: c.array });
    case "text":
      return db.createTextColumn({ ...common, xdefault: def });
    case "mediumtext":
      return db.createMediumtextColumn({ ...common, xdefault: def });
    case "longtext":
      return db.createLongtextColumn({ ...common, xdefault: def });
    case "integer":
      return db.createIntegerColumn({ ...common, min: c.min, max: c.max, xdefault: def });
    case "double":
      return db.createFloatColumn({ ...common, min: c.min, max: c.max, xdefault: def });
    case "boolean":
      return db.createBooleanColumn({ ...common, xdefault: def });
    case "datetime":
      return db.createDatetimeColumn({ ...common });
    case "enum":
      return db.createEnumColumn({ ...common, elements: [...c.elements], xdefault: def });
  }
}

async function waitColumns(tableId: string) {
  for (let i = 0; i < 60; i++) {
    const { columns } = await db.listColumns({ databaseId: DB_ID, tableId, queries: [Query.limit(200)] });
    const pending = (columns as { status: string; key: string }[]).filter((c) => c.status !== "available");
    const failed = pending.filter((c) => c.status === "failed");
    if (failed.length) throw new Error(`${tableId}: columns failed → ${failed.map((c) => c.key).join(", ")}`);
    if (!pending.length) return;
    await sleep(1000);
  }
  throw new Error(`${tableId}: columns not ready`);
}

async function ensureDatabase() {
  try {
    await db.get({ databaseId: DB_ID });
    log(`database "${DB_ID}" exists`);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await db.create({ databaseId: DB_ID, name: "GymOS" });
    log(`database "${DB_ID}" created`);
  }
}

async function ensureTable(t: TableDef) {
  const rowSecurity = t.access !== "private";
  let exists = true;
  try {
    await db.getTable({ databaseId: DB_ID, tableId: t.id });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    exists = false;
  }

  if (!exists) {
    await db.createTable({
      databaseId: DB_ID,
      tableId: t.id,
      name: t.name,
      permissions: [], // clients never get table-level access; rows carry team permissions
      rowSecurity,
      enabled: true,
      columns: t.columns.map(colPayload),
      indexes: t.indexes.map((i) => ({ key: i.key, type: i.type, attributes: i.attributes, orders: i.orders })),
    });
    await waitColumns(t.id);
    log(`table ${t.id} created (${t.columns.length} columns, ${t.indexes.length} indexes)`);
    return;
  }

  await db.updateTable({ databaseId: DB_ID, tableId: t.id, name: t.name, permissions: [], rowSecurity, enabled: true });
  const { columns } = await db.listColumns({ databaseId: DB_ID, tableId: t.id, queries: [Query.limit(200)] });
  const have = new Set((columns as { key: string }[]).map((c) => c.key));
  const missing = t.columns.filter((c) => !have.has(c.key));
  for (const c of missing) await addColumn(t.id, c);
  if (missing.length) await waitColumns(t.id);
  // enums only ever grow: add new elements to existing enum columns
  for (const c of t.columns) {
    if (c.type !== "enum" || !have.has(c.key)) continue;
    const live = (columns as { key: string; elements?: string[]; default?: string | null; required?: boolean }[]).find((x) => x.key === c.key);
    const extra = c.elements.filter((e) => !live?.elements?.includes(e));
    if (!live || !extra.length) continue;
    await db.updateEnumColumn({
      databaseId: DB_ID,
      tableId: t.id,
      key: c.key,
      elements: [...new Set([...(live.elements ?? []), ...c.elements])],
      required: live.required ?? false,
      xdefault: (live.default ?? null) as never,
    });
    log(`  ~ enum ${t.id}.${c.key} += ${extra.join(", ")}`);
  }

  const { indexes } = await db.listIndexes({ databaseId: DB_ID, tableId: t.id, queries: [Query.limit(100)] });
  const haveIdx = new Set((indexes as { key: string }[]).map((i) => i.key));
  for (const i of t.indexes.filter((i) => !haveIdx.has(i.key))) {
    await db.createIndex({ databaseId: DB_ID, tableId: t.id, key: i.key, type: i.type as never, columns: i.attributes, orders: i.orders as never });
    log(`  + index ${t.id}.${i.key}`);
  }
  log(`table ${t.id} ok${missing.length ? ` (+${missing.length} columns)` : ""}`);
}

async function ensureBucket(id: string, name: string, opts: { publicRead: boolean; maxMb: number }) {
  const cfg = {
    bucketId: id,
    name,
    permissions: opts.publicRead ? [Permission.read(Role.any())] : [],
    fileSecurity: !opts.publicRead,
    enabled: true,
    maximumFileSize: opts.maxMb * 1024 * 1024,
    allowedFileExtensions: ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"],
    compression: Compression.Gzip,
    encryption: true,
    antivirus: true,
  };
  try {
    await storage.getBucket({ bucketId: id });
    await storage.updateBucket(cfg);
    log(`bucket ${id} ok`);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await storage.createBucket(cfg);
    log(`bucket ${id} created`);
  }
}

function generatePassword(len = 18) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%^&*-_=+"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < len) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function ensureSuperAdmins() {
  const emails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const created: string[] = [];
  for (const email of emails) {
    const { users: found } = await users.list({ queries: [Query.equal("email", email)] });
    let user = found[0];
    if (!user) {
      const password = generatePassword();
      user = await users.create({ userId: ID.unique(), email, password, name: "AvniX Admin" });
      created.push(`${email}\t${password}`);
      log(`super-admin ${email} created`);
    }
    const labels = new Set([...(user.labels || []), "superadmin"]);
    await users.updateLabels({ userId: user.$id, labels: [...labels] });
    if (!user.emailVerification) await users.updateEmailVerification({ userId: user.$id, emailVerification: true });
    log(`super-admin ${email} labelled`);
  }
  if (created.length) {
    writeFileSync(
      ".superadmin-credentials",
      `# GymOS super-admin credentials — shown once. Sign in, change the password, then delete this file.\n${created.join("\n")}\n`,
      { mode: 0o600 },
    );
    log("one-time credentials written to ./.superadmin-credentials");
  }
}

async function ensureSite() {
  const siteId = process.env.APPWRITE_SITE_ID || "gymos-web";
  try {
    await sites.get({ siteId });
    log(`site ${siteId} exists`);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await sites.create({
      siteId,
      name: "GymOS",
      framework: Framework.Nextjs,
      buildRuntime: BuildRuntime.Node22,
      adapter: Adapter.Ssr,
      installCommand: "npm ci",
      buildCommand: "npm run build",
      outputDirectory: "./.next",
      timeout: 120,
      logging: true,
    });
    log(`site ${siteId} created`);
  }
  // Root app domain → site
  const root = process.env.ROOT_DOMAIN;
  if (root) {
    const { rules } = await proxy.listRules({ queries: [Query.equal("domain", root)] });
    if (!rules.length) {
      try {
        await proxy.createSiteRule({ domain: root, siteId });
        log(`proxy rule ${root} → ${siteId} created (verifies once DNS points to Appwrite)`);
      } catch (e) {
        log(`proxy rule ${root} skipped: ${(e as Error).message}`);
      }
    } else log(`proxy rule ${root} exists (${(rules[0] as { status?: string }).status})`);
  }
}

async function main() {
  await ensureDatabase();
  for (const t of TABLES) await ensureTable(t);
  await ensureBucket(BUCKETS.gymMedia, "Gym media (public site images)", { publicRead: true, maxMb: 8 });
  await ensureBucket(BUCKETS.memberPhotos, "Member photos", { publicRead: false, maxMb: 5 });
  await ensureSuperAdmins();
  await ensureSite();
  log("done ✔");
}

main().catch((e) => {
  console.error("✖", e?.message || e);
  process.exit(1);
});
