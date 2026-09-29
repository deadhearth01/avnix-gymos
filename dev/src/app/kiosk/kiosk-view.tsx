"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CircleX, Maximize, ScanFace, TriangleAlert, Webcam } from "@/components/icons";
import { averageEmbedding, checkFrame, loadFaceEngine, useCamera, type FaceIssue } from "@/components/face/face-engine";
import { FaceIssueCard } from "@/components/face/face-guide";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { fmtDate } from "@/lib/format";
import type { ActionResult } from "@/lib/types";
import type { KioskResult } from "@/app/(gym)/_actions/devices";

type Identify = (embedding: number[]) => Promise<ActionResult<KioskResult>>;
type Shown = KioskResult & { key: number };

const CAMERA_KEY = "gymos:kiosk-camera";
const STABLE_FRAMES = 4;
const RESULT_MS = 3800;
const COOLDOWN_MS = 2500;

function readCamera() {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch {
    return null;
  }
}

/**
 * Full-screen Face ID kiosk. Put a tablet or laptop at the entrance, open this page once,
 * and members check in by looking at the camera. Works with any camera the browser can see.
 */
export function KioskView({ gymName, identify }: { gymName: string; identify: Identify }) {
  const reduced = useReducedMotion();
  const [deviceId, setDeviceId] = React.useState<string | null>(readCamera);
  const { videoRef, error, devices, stream } = useCamera(deviceId);
  const [engineState, setEngineState] = React.useState<"loading" | "ready" | "failed">("loading");
  const [hint, setHint] = React.useState("Starting camera…");
  // shown only once the same problem persists (~0.5 s), so tips don't flicker
  const [issue, setIssue] = React.useState<FaceIssue>("none");
  const [progress, setProgress] = React.useState(0);
  const [shown, setShown] = React.useState<Shown | null>(null);
  const busy = React.useRef(false);
  const pauseUntil = React.useRef(0);

  React.useEffect(() => {
    let alive = true;
    loadFaceEngine()
      .then(() => alive && setEngineState("ready"))
      .catch(() => alive && setEngineState("failed"));
    return () => {
      alive = false;
    };
  }, []);

  // Detection loop: ~8 fps, only while the camera and engine are ready.
  React.useEffect(() => {
    if (engineState !== "ready" || !stream) return;
    let stop = false;
    let stable: number[][] = [];
    let lastIssue: FaceIssue = "none";
    let streak = 0;
    const tick = async () => {
      if (stop) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !busy.current && Date.now() > pauseUntil.current) {
        const human = await loadFaceEngine();
        const res = await human.detect(video);
        const check = checkFrame(res.face, video);
        streak = check.issue === lastIssue ? streak + 1 : 0;
        lastIssue = check.issue;
        setIssue(check.ok ? "none" : streak >= 4 ? check.issue : (cur) => (cur === check.issue ? cur : "none"));
        if (check.ok && check.face?.embedding) {
          stable.push(check.face.embedding);
          setProgress(Math.min(1, stable.length / STABLE_FRAMES));
          setHint("Hold still…");
          if (stable.length >= STABLE_FRAMES) {
            const embedding = averageEmbedding(stable.slice(-3));
            stable = [];
            busy.current = true;
            try {
              const r = await identify(embedding);
              if (r.ok && r.data) {
                setShown({ ...r.data, key: Date.now() });
                emitFeedback(
                  r.data.state === "checked_in" ? "success" : r.data.state === "duplicate" ? "select" : r.data.state === "unknown" ? "error" : "warning",
                );
              } else setHint(r.ok ? "Try again" : r.error);
            } catch {
              setHint("Connection problem — trying again");
            } finally {
              pauseUntil.current = Date.now() + RESULT_MS + COOLDOWN_MS;
              window.setTimeout(() => setShown(null), RESULT_MS);
              busy.current = false;
              setProgress(0);
            }
          }
        } else {
          stable = [];
          setProgress(0);
          setHint(check.hint);
        }
      }
      window.setTimeout(tick, 120);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [engineState, stream, identify, videoRef]);

  const chooseCamera = (id: string) => {
    setDeviceId(id);
    try {
      localStorage.setItem(CAMERA_KEY, id);
    } catch {
      /* per-device convenience only */
    }
  };

  const status =
    error ?? (engineState === "loading" ? "Loading Face ID…" : engineState === "failed" ? "Face ID couldn’t load on this browser. Use Chrome or Edge." : hint);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#08090b] text-white select-none">
      <video ref={videoRef} playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover opacity-90" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Link href="/devices" className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20" aria-label="Leave kiosk">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="text-center">
          <p className="font-display text-lg font-bold">{gymName}</p>
          <p className="text-xs text-white/60">Face ID check-in</p>
        </div>
        <div className="flex items-center gap-2">
          {devices.length > 1 && (
            <label className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-3 text-sm backdrop-blur-md">
              <Webcam className="size-4" />
              <span className="sr-only">Camera</span>
              <select
                value={deviceId ?? ""}
                onChange={(e) => chooseCamera(e.target.value)}
                className="max-w-40 bg-transparent text-sm outline-none [&>option]:text-black"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            aria-label="Full screen"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
            className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"
          >
            <Maximize className="size-5" />
          </button>
        </div>
      </header>

      {/* face guide */}
      <div
        aria-hidden
        className="absolute top-[46%] left-1/2 aspect-[0.76] h-[min(62vh,78vw)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] shadow-[0_0_0_200vmax_rgb(8_9_11/0.72)]"
      >
        <svg viewBox="0 0 100 131" className="size-full overflow-visible">
          <ellipse cx="50" cy="65.5" rx="49" ry="64.5" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="0.8" />
          <ellipse
            cx="50"
            cy="65.5"
            rx="49"
            ry="64.5"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
            opacity={progress > 0 ? 1 : 0}
            style={{ transition: reduced ? "none" : "stroke-dashoffset 160ms linear" }}
          />
        </svg>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-6 pb-10 text-center">
        <p
          role="status"
          aria-live="polite"
          className="mx-auto inline-flex items-center gap-2 rounded-full bg-black/45 px-5 py-2.5 text-base font-medium backdrop-blur-md"
        >
          {error ? <TriangleAlert className="size-5 text-warning" /> : <ScanFace className="size-5" />}
          {status}
        </p>
        <p className="mt-3 text-xs text-white/45">Only a face signature is compared — no photos are stored.</p>
      </div>

      {/* live tip for what the camera sees (mask, too far, backlight…) */}
      <div className="absolute inset-x-4 bottom-32 z-10 mx-auto max-w-sm">
        <AnimatePresence>
          {!shown && issue !== "none" && issue !== "still" && (
            <motion.div key={issue} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <FaceIssueCard issue={issue} dark />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* how-to strip while nobody is in front of the camera */}
      <div
        className={`absolute top-24 right-4 z-10 hidden w-56 rounded-2xl bg-black/45 p-3 backdrop-blur-md transition-opacity duration-500 lg:block ${issue === "none" && hint === "Look at the camera" && !shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <p className="mb-2 text-sm font-semibold">How to check in</p>
        <ul className="grid gap-2 text-xs text-white/85">
          {[
            ["face-center", "Stand in front, face inside the oval"],
            ["face-light", "Face the light"],
            ["no-mask", "Lower your mask for a moment"],
          ].map(([img, text], i) => (
            <li key={img} className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/face-guide/${img}.webp`} alt="" className="size-12 shrink-0 rounded-lg bg-white object-cover" />
              <span>
                {i + 1}. {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.key}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="absolute inset-x-4 bottom-8 z-20 mx-auto max-w-md rounded-[28px] p-6 text-center shadow-2xl sm:bottom-12"
            style={{
              background:
                shown.state === "checked_in"
                  ? "color-mix(in oklab, var(--primary) 92%, black)"
                  : shown.state === "duplicate"
                    ? "#1f2937"
                    : shown.state === "blocked"
                      ? "#92400e"
                      : "#7f1d1d",
            }}
          >
            {shown.state === "unknown" ? (
              <>
                <CircleX className="mx-auto size-10" />
                <p className="mt-3 font-display text-2xl font-bold">We don’t recognise you yet</p>
                <p className="mt-1 text-white/80">Please check in at the front desk.</p>
              </>
            ) : (
              <>
                <p className="font-display text-3xl font-bold">
                  {shown.state === "checked_in"
                    ? `Welcome, ${shown.firstName}`
                    : shown.state === "duplicate"
                      ? `You’re already in, ${shown.firstName}`
                      : `Hi ${shown.firstName}`}
                </p>
                <p className="mt-2 text-white/85">
                  {shown.state === "checked_in"
                    ? `Visit #${shown.visitCount}${shown.expiresAt ? ` · plan till ${fmtDate(shown.expiresAt, "dd MMM")}` : ""}`
                    : shown.state === "duplicate"
                      ? "Checked in within the last hour."
                      : "Your plan isn’t active. Please see the front desk."}
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
