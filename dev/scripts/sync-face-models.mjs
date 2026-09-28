// Copies the Face ID engine (browser bundle + the 5 face models) from node_modules into public/models/human.
import { cpSync, mkdirSync } from "node:fs";
const src = "node_modules/@vladmandic/human";
const out = "public/models/human";
mkdirSync(out, { recursive: true });
cpSync(`${src}/dist/human.esm.js`, `${out}/human.esm.js`);
for (const m of ["blazeface", "facemesh", "faceres", "antispoof", "liveness"])
  for (const ext of ["json", "bin"]) cpSync(`${src}/models/${m}.${ext}`, `${out}/${m}.${ext}`);
console.log("face models synced →", out);
