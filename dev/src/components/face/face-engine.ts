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
    detector: { rotation: true, maxDetected: 1, minConfidence: 0.55, return: false } as Config["face"]["detector"],
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

export type FaceCheck = {
  face: FaceResult | null;
  /** Ready to use: one clear, real, live, close-enough face. */
  ok: boolean;
  hint: string;
};

/** Quality gate shared by the kiosk and enrolment. */
export function checkFace(face: FaceResult | undefined, frameWidth: number): FaceCheck {
  if (!face) return { face: null, ok: false, hint: "Look at the camera" };
  const width = face.box[2];
  if (width < frameWidth * 0.16) return { face, ok: false, hint: "Come a little closer" };
  if ((face.faceScore ?? 0) < 0.6) return { face, ok: false, hint: "Hold still" };
  if ((face.real ?? 0) < 0.5) return { face, ok: false, hint: "Use your real face, not a photo" };
  if ((face.live ?? 0) < 0.5) return { face, ok: false, hint: "Hold still" };
  if (!face.embedding?.length) return { face, ok: false, hint: "Hold still" };
  return { face, ok: true, hint: "Hold still…" };
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
