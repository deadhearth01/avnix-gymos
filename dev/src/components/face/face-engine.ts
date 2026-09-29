"use client";

import * as React from "react";
import type { Config, FaceResult, Human } from "@vladmandic/human";

/**
 * Browser face engine.
 * - @vladmandic/human (MIT): BlazeFace detection, 468-point FaceMesh, anti-spoof and liveness.
 * - InsightFace ArcFace (EfficientNet-B0, 512-d; TFJS port of leondgarse/Keras_insightface): the identity
 *   embedding. Each face is aligned to ArcFace's standard 5-point template (eyes, nose, mouth corners)
 *   before embedding — the step that makes ArcFace accurate.
 * Models are served from /models/human and cached by the browser. Only embeddings (and, at enrolment,
 * one reference photo) leave the device.
 */
const CONFIG: Partial<Config> = {
  modelBasePath: "/models/human/",
  backend: "webgl",
  debug: false,
  async: true,
  // the built-in warm-up fetches a data: URL, which our CSP blocks; the first real frame warms up instead
  warmup: "none",
  cacheSensitivity: 0,
  filter: { enabled: true, equalization: true, flip: false } as Config["filter"],
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 2, minConfidence: 0.55, return: false } as Config["face"]["detector"],
    mesh: { enabled: true } as Config["face"]["mesh"],
    iris: { enabled: false } as Config["face"]["iris"],
    emotion: { enabled: false } as Config["face"]["emotion"],
    // identity comes from ArcFace below; Human's own FaceRes (an age/gender model) is off
    description: { enabled: false } as Config["face"]["description"],
    antispoof: { enabled: true } as Config["face"]["antispoof"],
    liveness: { enabled: true } as Config["face"]["liveness"],
    attention: { enabled: false } as Config["face"]["attention"],
    gear: { enabled: false } as Config["face"]["gear"],
  } as Config["face"],
  body: { enabled: false } as Config["body"],
  hand: { enabled: false } as Config["hand"],
  object: { enabled: false } as Config["object"],
  gesture: { enabled: false },
  segmentation: { enabled: false } as Config["segmentation"],
};

/** Vendored in models/face and copied to /models/human by scripts/sync-face-models.mjs. */
const ARCFACE_URL = "/models/human/insightface-efficientnet-b0.json";

type Tensor = { data(): Promise<Float32Array>; dispose(): void };
type GraphModel = { execute(input: unknown): Tensor };

export type FaceEngine = {
  human: Human;
  /** 512-d, L2-normalised identity embedding of a detected face, or null without landmarks. */
  embed: (source: HTMLVideoElement | HTMLImageElement, face: FaceResult) => Promise<number[] | null>;
};

let engine: Promise<FaceEngine> | null = null;

export function loadFaceEngine() {
  engine ??= (async () => {
    // Served from our own origin (copied from the package at build time) and loaded only on camera pages.
    const url = "/models/human/human.esm.js";
    const { Human: H } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as { Human: new (c: Partial<Config>) => Human };
    const human = new H(CONFIG);
    const [, arcface] = await Promise.all([human.load(), human.tf.loadGraphModel(ARCFACE_URL) as Promise<GraphModel>]);
    return { human, embed: (source, face) => embedFace(human, arcface, source, face) } satisfies FaceEngine;
  })().catch((e) => {
    engine = null;
    throw e;
  });
  return engine;
}

/** ArcFace's reference landmarks in its 112×112 input: left eye, right eye, nose tip, mouth corners. */
const ARCFACE_REF = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/** Least-squares similarity transform (rotation + uniform scale + shift) taking `src` onto the template. */
function alignTo(src: number[][]) {
  const n = src.length;
  let sx = 0, sy = 0, dx = 0, dy = 0; // prettier-ignore
  for (let i = 0; i < n; i++) {
    sx += src[i][0];
    sy += src[i][1];
    dx += ARCFACE_REF[i][0];
    dy += ARCFACE_REF[i][1];
  }
  sx /= n;
  sy /= n;
  dx /= n;
  dy /= n;
  let p = 0, q = 0, den = 0; // prettier-ignore
  for (let i = 0; i < n; i++) {
    const x = src[i][0] - sx;
    const y = src[i][1] - sy;
    const u = ARCFACE_REF[i][0] - dx;
    const v = ARCFACE_REF[i][1] - dy;
    p += x * u + y * v;
    q += x * v - y * u;
    den += x * x + y * y;
  }
  const a = p / den;
  const b = q / den;
  return { a, b, tx: dx - a * sx + b * sy, ty: dy - b * sx - a * sy };
}

let aligned: CanvasRenderingContext2D | null = null;

async function embedFace(human: Human, arcface: GraphModel, source: HTMLVideoElement | HTMLImageElement, face: FaceResult) {
  const m = face.mesh;
  if (!m || m.length < 468) return null;
  const mid = (i: number, j: number) => [(m[i][0] + m[j][0]) / 2, (m[i][1] + m[j][1]) / 2];
  // FaceMesh points: eye corners (33/133, 362/263), nose tip (4), mouth corners (61, 291)
  const t = alignTo([mid(33, 133), mid(362, 263), [m[4][0], m[4][1]], [m[61][0], m[61][1]], [m[291][0], m[291][1]]]);
  aligned ??= Object.assign(document.createElement("canvas"), { width: 112, height: 112 }).getContext("2d", { willReadFrequently: true });
  if (!aligned) return null;
  aligned.setTransform(1, 0, 0, 1, 0, 0);
  aligned.fillStyle = "#000";
  aligned.fillRect(0, 0, 112, 112);
  aligned.setTransform(t.a, t.b, -t.b, t.a, t.tx, t.ty);
  aligned.drawImage(source, 0, 0);
  const tf = human.tf;
  const out: Tensor = tf.tidy(() => arcface.execute(tf.expandDims(tf.div(tf.cast(tf.browser.fromPixels(aligned!.canvas), "float32"), 255), 0)));
  const raw = await out.data();
  out.dispose();
  let norm = 0;
  for (const x of raw) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return Array.from(raw, (x) => x / norm);
}

/** Head-and-shoulders reference photo (JPEG data URL) around a detected face, for staff to verify later. */
export function faceSnapshot(video: HTMLVideoElement, face: FaceResult, width = 480) {
  const [bx, by, bw, bh] = face.box;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const height = Math.round(width * 1.25);
  let sw = Math.min(bw * 2.1, vw);
  let sh = sw * 1.25;
  if (sh > vh) {
    sh = vh;
    sw = sh / 1.25;
  }
  const sx = Math.min(Math.max(bx + bw / 2 - sw / 2, 0), vw - sw);
  const sy = Math.min(Math.max(by + bh * 0.45 - sh * 0.42, 0), vh - sh);
  const c = Object.assign(document.createElement("canvas"), { width, height });
  c.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  return c.toDataURL("image/jpeg", 0.86);
}

/** Why a frame can't be used yet — each maps to an illustrated tip in the face guide. */
export type FaceIssue = "none" | "far" | "two" | "turned" | "covered" | "dark" | "backlit" | "photo" | "still";

export type FaceCheck = {
  face: FaceResult | null;
  /** Ready to use: one clear, real, live, close-enough face. */
  ok: boolean;
  issue: FaceIssue;
  hint: string;
};

const HINT: Record<FaceIssue, string> = {
  none: "Look at the camera",
  far: "Come a little closer",
  two: "One person at a time, please",
  turned: "Look straight at the screen",
  covered: "Remove your mask, sunglasses or cap",
  dark: "Too dark — face the light",
  backlit: "Too much light behind you — turn to face the light",
  photo: "Use your real face, not a photo",
  still: "Hold still",
};

let probe: CanvasRenderingContext2D | null = null;

/** Average brightness (0–255) of the whole frame and of the face box, from a tiny downscaled copy. */
function brightness(video: HTMLVideoElement, box: [number, number, number, number]) {
  const W = 64;
  const H = 48;
  probe ??= Object.assign(document.createElement("canvas"), { width: W, height: H }).getContext("2d", { willReadFrequently: true });
  if (!probe || !video.videoWidth) return null;
  probe.drawImage(video, 0, 0, W, H);
  const px = probe.getImageData(0, 0, W, H).data;
  const sx = W / video.videoWidth;
  const sy = H / video.videoHeight;
  const [bx, by, bw, bh] = [box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy];
  let all = 0;
  let face = 0;
  let faceN = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      all += l;
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        face += l;
        faceN++;
      }
    }
  return { frame: all / (W * H), face: faceN ? face / faceN : all / (W * H) };
}

/**
 * Quality gate shared by the kiosk and enrolment, with a specific reason when a frame isn't usable.
 * `strict` (enrolment) asks for a closer, straighter, clearer face so the saved Face ID is high quality.
 */
export function checkFrame(faces: FaceResult[], video: HTMLVideoElement, strict = false): FaceCheck {
  const bad = (issue: FaceIssue, face: FaceResult | null = null): FaceCheck => ({ face, ok: false, issue, hint: HINT[issue] });
  const face = faces[0];
  if (!face) return bad("none");
  if (faces.length > 1 && (faces[1].boxScore ?? 0) > 0.6) return bad("two", face);
  if (face.box[2] < (video.videoWidth || 1280) * (strict ? 0.22 : 0.16)) return bad("far", face);
  const angle = face.rotation?.angle;
  const maxTurn = strict ? 0.3 : 0.45;
  if (angle && (Math.abs(angle.yaw) > maxTurn || Math.abs(angle.pitch) > maxTurn)) return bad("turned", face);
  const light = brightness(video, face.box);
  if (light && light.face < 55) return bad(light.frame - light.face > 45 ? "backlit" : "dark", face);
  if ((face.boxScore ?? 0) > 0.6 && (face.faceScore ?? 0) < 0.55) return bad("covered", face);
  if ((face.faceScore ?? 0) < (strict ? 0.7 : 0.6)) return bad("still", face);
  // the anti-spoof model is cautious with studio-lit faces, so its bar is modest; staff watch enrolment
  if ((face.real ?? 0) < 0.35) return bad("photo", face);
  if ((face.live ?? 0) < (strict ? 0.6 : 0.5) || !face.mesh?.length) return bad("still", face);
  return { face, ok: true, issue: "none", hint: "Hold still…" };
}

export function averageEmbedding(list: number[][]) {
  const out = new Array<number>(list[0].length).fill(0);
  for (const v of list) for (let i = 0; i < v.length; i++) out[i] += v[i] / list.length;
  return out;
}

export type CameraState = { stream: MediaStream | null; error: string | null; devices: MediaDeviceInfo[] };

/** Any camera the OS exposes: built-in, USB, or a virtual camera (OBS, IP-camera drivers). */
export function useCamera(deviceId: string | null, active = true) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [state, setState] = React.useState<CameraState>({ stream: null, error: null, devices: [] });

  React.useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState({ stream, error: null, devices });
      } catch (e) {
        const name = (e as DOMException)?.name;
        setState((s) => ({
          ...s,
          stream: null,
          error:
            name === "NotAllowedError"
              ? "Camera access is blocked. Allow the camera for this site in the browser’s address bar."
              : name === "NotFoundError" || name === "OverconstrainedError"
                ? "No camera found. Connect a webcam and reload."
                : "The camera couldn’t start. Close other apps using it and reload.",
        }));
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId, active]);

  return { videoRef, ...state };
}
