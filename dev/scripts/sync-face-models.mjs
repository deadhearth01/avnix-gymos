// Copies the Face ID engine (browser bundle + face models) into public/models/human.
import { cpSync, mkdirSync } from "node:fs";
const src = "node_modules/@vladmandic/human";
const out = "public/models/human";
mkdirSync(out, { recursive: true });
cpSync(`${src}/dist/human.esm.js`, `${out}/human.esm.js`);
// detection, landmarks, anti-spoof and liveness from Human (MIT)
for (const m of ["blazeface", "facemesh", "antispoof", "liveness"])
  for (const ext of ["json", "bin"]) cpSync(`${src}/models/${m}.${ext}`, `${out}/${m}.${ext}`);
// identity: InsightFace ArcFace EfficientNet-B0, TFJS port (vendored in /models/face from vladmandic/insightface)
for (const ext of ["json", "bin"]) cpSync(`models/face/insightface-efficientnet-b0.${ext}`, `${out}/insightface-efficientnet-b0.${ext}`);
console.log("face models synced →", out);
