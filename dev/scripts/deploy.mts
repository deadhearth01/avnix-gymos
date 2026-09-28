/**
 * Deploy to Appwrite.
 *   npm run deploy:site        → sync env vars to the Site, upload source, build & activate
 *   npm run deploy:functions   → create/update the scheduler Function and deploy it
 * APP_URL for production defaults to https://<ROOT_DOMAIN>; override with PROD_APP_URL.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, Functions, ID, Sites, Runtime, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const e = process.env;
const client = new Client().setEndpoint(e.APPWRITE_ENDPOINT!).setProject(e.APPWRITE_PROJECT_ID!).setKey(e.APPWRITE_API_KEY!);
const sites = new Sites(client);
const functions = new Functions(client);
const SITE = e.APPWRITE_SITE_ID || "gymos-web";
const PROD_URL = e.PROD_APP_URL || `https://${e.ROOT_DOMAIN}`;
const log = (...a: unknown[]) => console.log("•", ...a);

const SITE_VARS: [string, boolean][] = [
  ["APPWRITE_ENDPOINT", false],
  ["APPWRITE_PROJECT_ID", false],
  ["APPWRITE_API_KEY", true],
  ["APPWRITE_DATABASE_ID", false],
  ["APPWRITE_SITE_ID", false],
  ["NEXT_PUBLIC_APPWRITE_ENDPOINT", false],
  ["NEXT_PUBLIC_APPWRITE_PROJECT_ID", false],
  ["NEXT_PUBLIC_APP_NAME", false],
  ["NEXT_PUBLIC_ROOT_DOMAIN", false],
  ["APP_SECRET", true],
  ["CRON_SECRET", true],
  ["ROOT_DOMAIN", false],
  ["SUPER_ADMIN_EMAILS", false],
  ["TWILIO_ACCOUNT_SID", true],
  ["TWILIO_AUTH_TOKEN", true],
  ["TWILIO_VERIFY_SERVICE_SID", true],
  ["TWILIO_EMAIL_FROM", false],
  ["TWILIO_EMAIL_FROM_NAME", false],
  ["APPWRITE_DOMAIN_TARGET_CNAME", false],
  ["APPWRITE_DOMAIN_TARGET_A", false],
  ["APP_HOSTS", false],
];

async function upsertVars(kind: "site" | "fn", id: string, vars: Record<string, { value: string; secret: boolean }>) {
  const list = kind === "site" ? await sites.listVariables({ siteId: id }) : await functions.listVariables({ functionId: id });
  const have = new Map(list.variables.map((v) => [v.key, v.$id]));
  for (const [key, { value, secret }] of Object.entries(vars)) {
    if (!value) continue;
    const existing = have.get(key);
    if (kind === "site") {
      if (existing) await sites.updateVariable({ siteId: id, variableId: existing, key, value, secret });
      else await sites.createVariable({ siteId: id, variableId: ID.unique(), key, value, secret });
    } else {
      if (existing) await functions.updateVariable({ functionId: id, variableId: existing, key, value, secret });
      else await functions.createVariable({ functionId: id, variableId: ID.unique(), key, value, secret });
    }
  }
  log(`${kind} ${id}: ${Object.keys(vars).length} variables synced`);
}

/** Tar an explicit allow-list of paths (never secrets, node_modules or build output). */
function tarball(dir: string, include: string[]) {
  const out = join(mkdtempSync(join(tmpdir(), "gymos-")), "code.tar.gz");
  const present = include.filter((p) => existsSync(join(dir, p)));
  execFileSync("tar", ["-czf", out, "-C", dir, ...present], { stdio: "inherit" });
  return out;
}

async function waitDeployment(get: () => Promise<{ status: string; buildLogs?: string }>) {
  let last = "";
  for (let i = 0; i < 240; i++) {
    const d = await get();
    if (d.status !== last) log(`  status: ${d.status}`);
    last = d.status;
    if (d.status === "ready") return d;
    if (d.status === "failed" || d.status === "canceled") {
      console.error(d.buildLogs?.slice(-6000));
      throw new Error(`deployment ${d.status}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("deployment timed out");
}

async function deploySite() {
  const vars = Object.fromEntries(SITE_VARS.map(([k, secret]) => [k, { value: e[k] ?? "", secret }]));
  vars.APP_URL = { value: PROD_URL, secret: false };
  await upsertVars("site", SITE, vars);
  const file = tarball(process.cwd(), [
    "src",
    "public",
    "scripts/sync-face-models.mjs",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "components.json",
    "eslint.config.mjs",
    "next-env.d.ts",
  ]);
  log("uploading source…");
  const dep = await sites.createDeployment({ siteId: SITE, code: InputFile.fromPath(file, "code.tar.gz"), activate: true });
  rmSync(file, { force: true });
  log(`deployment ${dep.$id} created — building on Appwrite`);
  await waitDeployment(() => sites.getDeployment({ siteId: SITE, deploymentId: dep.$id }) as never);
  const { rules } = await new (await import("node-appwrite")).Proxy(client)
    .listRules({ queries: [Query.equal("deploymentResourceId", SITE), Query.limit(50)] })
    .catch(() => ({ rules: [] as { domain: string; status: string }[] }));
  log("live ✔ domains:", rules.map((r) => `${r.domain} (${r.status})`).join(", ") || "(none)");
}

async function deployFunctions() {
  const functionId = "gymos-scheduler";
  try {
    await functions.get({ functionId });
    await functions.update({
      functionId,
      name: "GymOS scheduler",
      runtime: Runtime.Node22,
      execute: [],
      schedule: "*/30 * * * *",
      timeout: 300,
      entrypoint: "src/main.js",
      logging: true,
      enabled: true,
    });
    log("function updated");
  } catch {
    await functions.create({
      functionId,
      name: "GymOS scheduler",
      runtime: Runtime.Node22,
      execute: [],
      schedule: "*/30 * * * *",
      timeout: 300,
      entrypoint: "src/main.js",
      logging: true,
      enabled: true,
    });
    log("function created");
  }
  await upsertVars("fn", functionId, { APP_URL: { value: PROD_URL, secret: false }, CRON_SECRET: { value: e.CRON_SECRET ?? "", secret: true } });
  const file = tarball(join(process.cwd(), "appwrite/functions/scheduler"), ["package.json", "src"]);
  const dep = await functions.createDeployment({ functionId, code: InputFile.fromPath(file, "code.tar.gz"), activate: true, entrypoint: "src/main.js" });
  rmSync(file, { force: true });
  await waitDeployment(() => functions.getDeployment({ functionId, deploymentId: dep.$id }) as never);
  log("scheduler live ✔ (every 30 min)");
}

const what = process.argv[2];
(what === "site" ? deploySite() : what === "functions" ? deployFunctions() : Promise.reject(new Error("usage: deploy site|functions"))).catch((err) => {
  console.error("✖", err?.message ?? err);
  process.exit(1);
});
