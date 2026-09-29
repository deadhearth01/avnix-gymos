"use client";

import * as React from "react";
import type { Config, FaceResult, Human } from "@vladmandic/human";

/**
 * Browser face engine (@vladmandic/human, MIT): BlazeFace detection, FaceMesh alignment, FaceRes 1024-d
 * embedding, anti-spoof and liveness. Models are served from /models/human and cached by the browser.
 * Only embeddings leave the device — never frames.
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
    description: { enabled: true } as Config["face"]["description"],
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

let engine: Promise<Human> | null = null;

export function loadFaceEngine() {
  engine ??= (async () => {
    // Served from our own origin (copied from the package at build time) and loaded only on camera pages.
    const url = "/models/human/human.esm.js";
    const { Human: H } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as { Human: new (c: Partial<Config>) => Human };
    const human = new H(CONFIG);
    await human.load();
    return human;
  })().catch((e) => {
    engine = null;
    throw e;
  });
  return engine;
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

/** Quality gate shared by the kiosk and enrolment, with a specific reason when a frame isn't usable. */
export function checkFrame(faces: FaceResult[], video: HTMLVideoElement): FaceCheck {
  const bad = (issue: FaceIssue, face: FaceResult | null = null): FaceCheck => ({ face, ok: false, issue, hint: HINT[issue] });
  const face = faces[0];
  if (!face) return bad("none");
  if (faces.length > 1 && (faces[1].boxScore ?? 0) > 0.6) return bad("two", face);
  if (face.box[2] < (video.videoWidth || 1280) * 0.16) return bad("far", face);
  const angle = face.rotation?.angle;
  if (angle && (Math.abs(angle.yaw) > 0.45 || Math.abs(angle.pitch) > 0.45)) return bad("turned", face);
  const light = brightness(video, face.box);
  if (light && light.face < 55) return bad(light.frame - light.face > 45 ? "backlit" : "dark", face);
  if ((face.boxScore ?? 0) > 0.6 && (face.faceScore ?? 0) < 0.55) return bad("covered", face);
  if ((face.faceScore ?? 0) < 0.6) return bad("still", face);
  if ((face.real ?? 0) < 0.5) return bad("photo", face);
  if ((face.live ?? 0) < 0.5 || !face.embedding?.length) return bad("still", face);
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
