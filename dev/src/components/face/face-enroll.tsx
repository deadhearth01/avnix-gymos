"use client";

import * as React from "react";
import { ArrowLeft, Camera, Check, RefreshCw, Sun, Trash2, X } from "@/components/icons";
import { averageEmbedding, checkFrame, faceSnapshot, loadFaceEngine, useCamera, type FaceIssue } from "@/components/face/face-engine";
import { FACE_TIPS, FaceGuideGrid } from "@/components/face/face-guide";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Milliseconds of steady, good-quality face needed to fill the ring. */
const HOLD_MS = 2600;
/** A sample every this-many ms of good face → about 5 slightly different views. */
const SAMPLE_EVERY = 480;
const MAX_SAMPLES = 5;

type Phase = "loading" | "scanning" | "done" | "error";

/** Oval just outside the camera window (viewBox 100×128), starting at 12 o'clock. */
const RING = "M50 -3.5 A53.5 67.5 0 1 1 50 131.5 A53.5 67.5 0 1 1 50 -3.5";

const ISSUE_TIP: Partial<Record<FaceIssue, (typeof FACE_TIPS)[number]>> = {
  far: FACE_TIPS[5],
  two: FACE_TIPS[6],
  turned: FACE_TIPS[7],
  covered: FACE_TIPS[2],
  backlit: FACE_TIPS[4],
  dark: { ...FACE_TIPS[1], title: "Too dark", body: "Turn the screen brightness up and face a window or lamp." },
  photo: { ...FACE_TIPS[0], title: "Real face only", body: "Photos and phone screens are refused. The member stands in front of the camera." },
  still: { ...FACE_TIPS[0], title: "Hold still, eyes open", body: "Stay steady and look straight at the screen for a moment." },
};

/** Staff enrol a member's face for the kiosk. Needs the member present and consenting. */
export function FaceEnrollDialog({
  open,
  onClose,
  memberId,
  memberName,
  enrolled,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  enrolled: boolean;
  /** Called with the new state; the page updates itself without reloading. */
  onDone: (enrolled: boolean) => void;
}) {
  const [step, setStep] = React.useState<"guide" | "scan">("guide");
  const [consent, setConsent] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [progress, setProgress] = React.useState(0);
  const [issue, setIssue] = React.useState<FaceIssue>("none");
  const [samples, setSamples] = React.useState<number[][]>([]);
  const [attempt, setAttempt] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const request = React.useRef<AbortController | null>(null);
  /** Reference photo: the clearest frame of the scan, kept so staff can verify the Face ID later. */
  const photo = React.useRef<string | null>(null);
  const { videoRef, error, stream } = useCamera(null, open && step === "scan");
  const first = memberName.split(" ")[0];

  // Scan loop: fills the ring while a good face is held; pauses (doesn't reset) on a problem.
  React.useEffect(() => {
    if (!open || step !== "scan" || !stream) return;
    let stop = false;
    let good = 0;
    let lastT = performance.now();
    let nextSample = 0;
    let collected: number[][] = [];
    let lastIssue: FaceIssue = "none";
    let streak = 0;
    let bestScore = 0;
    const tick = async () => {
      if (stop) return;
      try {
        const { human, embed } = await loadFaceEngine();
        if (stop) return;
        setPhase((p) => (p === "loading" ? "scanning" : p));
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const res = await human.detect(video);
          if (stop) return;
          const now = performance.now();
          const dt = Math.min(now - lastT, 250);
          lastT = now;
          const check = checkFrame(res.face, video, true);
          streak = check.issue === lastIssue ? streak + 1 : 0;
          lastIssue = check.issue;
          if (check.ok && check.face) {
            setIssue("none");
            good += dt;
            if (good >= nextSample && collected.length < MAX_SAMPLES) {
              const embedding = await embed(video, check.face);
              if (stop) return;
              if (embedding) {
                collected = [...collected, embedding];
                nextSample = good + SAMPLE_EVERY;
                const score = (check.face.faceScore ?? 0) + (check.face.real ?? 0) * 0.2;
                if (score >= bestScore) {
                  bestScore = score;
                  photo.current = faceSnapshot(video, check.face);
                }
              }
            }
            setProgress(Math.min(1, good / HOLD_MS));
            if (good >= HOLD_MS && collected.length >= 3) {
              setSamples(collected);
              setPhase("done");
              emitFeedback("success");
              return;
            }
          } else if (streak >= 3) setIssue(check.issue);
        }
      } catch {
        if (!stop) setPhase("error");
        return;
      }
      window.setTimeout(tick, 110);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [open, step, stream, videoRef, attempt]);

  const restart = () => {
    photo.current = null;
    setSamples([]);
    setProgress(0);
    setIssue("none");
    setSaveError(null);
    setPhase("scanning");
    setAttempt((a) => a + 1);
  };

  const reset = () => {
    request.current?.abort();
    photo.current = null;
    setStep("guide");
    setConsent(false);
    setPhase("loading");
    setProgress(0);
    setIssue("none");
    setSamples([]);
    setSaving(false);
    setSaveError(null);
  };

  /** Plain, cancellable request — closing the dialog aborts it and nothing else waits on it. */
  const call = async (url: string, init: RequestInit) => {
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { "content-type": "application/json" } });
    return (await res.json()) as { ok: boolean; error?: string };
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // the individual views plus their average: steadier than any single frame
      const views = samples.length >= 3 ? [...samples.slice(0, 4), averageEmbedding(samples)] : samples;
      const r = await call("/api/face/enroll", { method: "POST", body: JSON.stringify({ memberId, embeddings: views, consent, photo: photo.current }) });
      if (!r.ok) {
        setSaveError(r.error ?? "Face ID not saved.");
        return void notify.error("Face ID not saved", { description: r.error, duration: 9000 });
      }
      notify.success(`${first} can now check in with Face ID`);
      onDone(true);
      onClose();
      reset();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setSaveError("Couldn’t reach the server. Check the internet connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const r = await call(`/api/face/enroll?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
      if (!r.ok) return void notify.error(r.error ?? "Couldn’t delete Face ID.");
      notify.success("Face ID deleted");
      onDone(false);
      onClose();
      reset();
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify.error("Couldn’t reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const tip = ISSUE_TIP[issue];
  const guide =
    phase === "done"
      ? { img: "face-center", title: "Face captured", body: `Tap Save to finish ${first}’s Face ID.`, good: true }
      : phase === "error" || error
        ? { img: "face-light", title: "Camera problem", body: error ?? "Face ID couldn’t start on this browser. Use Chrome or Edge.", good: false }
        : tip
          ? { img: tip.img, title: tip.title, body: tip.body, good: false }
          : phase === "loading"
            ? { img: "face-center", title: "Getting ready…", body: "Starting the camera and Face ID. The first time takes a few seconds.", good: true }
            : progress > 0.02
              ? { img: "face-center", title: "Hold still…", body: "Keep looking at the screen until the circle is full.", good: true }
              : { img: "face-center", title: "Fit your face in the circle", body: "Face the camera with your head and shoulders in view.", good: true };
  const stage = phase === "done" ? 3 : progress > 0.02 ? 2 : 1;

  const close = () => {
    reset();
    onClose();
  };

  const footer = (
    <>
      {saveError && (
        <p
          role="alert"
          className={cn(
            "rounded-xl border border-destructive/30 bg-danger-soft p-3 text-sm text-danger-ink",
            step === "scan" && "border-red-200 bg-red-50 text-red-800 dark:border-red-200 dark:bg-red-50 dark:text-red-800",
          )}
        >
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {enrolled && step === "guide" ? (
          <Button variant="destructive-soft" onClick={() => void remove()} disabled={saving}>
            <Trash2 /> Delete Face ID
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {step === "scan" && (phase === "done" || saveError) && (
            <Button
              variant="outline"
              onClick={restart}
              disabled={saving}
              className="border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-300 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              <RefreshCw /> Scan again
            </Button>
          )}
          {step === "guide" ? (
            <Button onClick={() => setStep("scan")} disabled={!consent}>
              <Camera /> {first} is ready — start scan
            </Button>
          ) : (
            <Button onClick={() => void save()} loading={saving} disabled={phase !== "done"}>
              Save Face ID
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      {step === "guide" ? (
        <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{enrolled ? "Update Face ID" : "Set up Face ID"}</DialogTitle>
            <DialogDescription>
              Before scanning, check {first} is ready. We save a face signature and one reference photo — used only for check-in and for your staff to verify
              it.
            </DialogDescription>
          </DialogHeader>
          <FaceGuideGrid />
          <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
            <span>{first} agrees to use Face ID for check-in. They can ask the gym to delete it, and the photo, at any time.</span>
          </label>
          {footer}
        </DialogContent>
      ) : (
        // Scanning: a full-screen white page. The bright screen lights the face like a ring light.
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none bg-white p-0 text-neutral-900 ring-0 sm:max-w-none"
        >
          <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-3 px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={() => {
                request.current?.abort();
                setStep("guide");
                restart();
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
              aria-label="Back to the checklist"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <DialogTitle className="text-lg text-neutral-900">{enrolled ? `Update ${first}’s Face ID` : `Face ID for ${memberName}`}</DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center justify-center gap-1.5 text-neutral-500">
                <Sun className="size-4 shrink-0 text-amber-500" /> The white screen lights the face — keep brightness up.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid size-10 shrink-0 place-items-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6 sm:px-6">
            {/* the camera shows only inside the oval; the ring around it fills while the face is held still */}
            <div className="relative aspect-[100/128] w-[min(calc(100vw-4.5rem),42dvh,420px)]">
              <div className="absolute inset-0 overflow-hidden rounded-[50%] bg-neutral-200 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.35)]">
                <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
              </div>
              <svg viewBox="0 0 100 128" aria-hidden className="absolute inset-0 size-full overflow-visible">
                <path d={RING} fill="none" stroke="#ececec" strokeWidth="2.2" />
                {/* drawn as a path that starts at the top, so the fill runs clockwise from 12 o'clock */}
                <path
                  d={RING}
                  fill="none"
                  stroke={phase === "done" ? "var(--success)" : "var(--primary)"}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - (phase === "done" ? 1 : progress)}
                  opacity={progress > 0 || phase === "done" ? 1 : 0}
                  style={{ transition: "stroke-dashoffset 140ms linear, stroke 300ms" }}
                />
              </svg>
              {phase === "done" && (
                <span className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-success text-white shadow-lg">
                  <Check className="size-10" />
                </span>
              )}
              {phase === "scanning" && progress > 0 && (
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white tabular-nums">
                  {Math.round(progress * 100)}%
                </span>
              )}
            </div>

            <div className="w-full max-w-md space-y-3">
              {/* live guide — picture + instruction for what the camera sees right now */}
              <div
                role="status"
                aria-live="polite"
                data-issue={issue}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-2.5 pr-4"
              >
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand/face-guide/${guide.img}.webp`} alt="" className="size-full object-cover" />
                  <span
                    className={cn(
                      "absolute right-1 bottom-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-white",
                      guide.good ? "bg-success" : "bg-destructive",
                    )}
                  >
                    {guide.good ? <Check className="size-3" /> : <span className="text-[10px] font-bold">!</span>}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900">{guide.title}</span>
                  <span className="block text-xs text-neutral-500">{guide.body}</span>
                </span>
              </div>

              <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Steps">
                {["Fit face in circle", "Hold still", "Save"].map((label, i) => (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5",
                      stage === i + 1 ? "bg-primary/10 font-semibold text-primary" : stage > i + 1 ? "text-green-700" : "text-neutral-500",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border border-neutral-300 text-[10px]",
                        stage > i + 1 && "border-success bg-success text-white",
                      )}
                    >
                      {stage > i + 1 ? <Check className="size-3" /> : i + 1}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
              {footer}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
