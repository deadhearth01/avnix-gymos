"use client";

import * as React from "react";
import { Camera, ScanFace, Trash2 } from "@/components/icons";
import { checkFrame, loadFaceEngine, useCamera, type FaceIssue } from "@/components/face/face-engine";
import { FaceGuideGrid, FaceIssueCard } from "@/components/face/face-guide";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emitFeedback } from "@/components/feedback/feedback-provider";
import { notify } from "@/lib/notify";
import { deleteFaceAction, enrollFaceAction } from "@/app/(gym)/_actions/devices";

const SAMPLES = 3;

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
  onDone: () => void;
}) {
  const [step, setStep] = React.useState<"guide" | "scan">("guide");
  const [issue, setIssue] = React.useState<FaceIssue>("none");
  const [consent, setConsent] = React.useState(false);
  const [capturing, setCapturing] = React.useState(false);
  const [samples, setSamples] = React.useState<number[][]>([]);
  const [hint, setHint] = React.useState("Loading Face ID…");
  const [saving, start] = React.useTransition();
  const { videoRef, error, stream } = useCamera(null, open && step === "scan");
  const first = memberName.split(" ")[0];

  React.useEffect(() => {
    if (!open || !capturing || !stream) return;
    let stop = false;
    let collected: number[][] = [];
    let last = 0;
    let lastIssue: FaceIssue = "none";
    let streak = 0;
    const tick = async () => {
      if (stop) return;
      const human = await loadFaceEngine();
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        const res = await human.detect(video);
        const check = checkFrame(res.face, video);
        setHint(check.ok ? "Great — hold still" : check.hint);
        streak = check.issue === lastIssue ? streak + 1 : 0;
        lastIssue = check.issue;
        if (check.ok) setIssue("none");
        else if (streak >= 4) setIssue(check.issue);
        // samples at least 350 ms apart so they differ slightly (better matching)
        if (check.ok && check.face?.embedding && Date.now() - last > 350) {
          last = Date.now();
          collected = [...collected, check.face.embedding];
          setSamples(collected);
          emitFeedback("tap");
          if (collected.length >= SAMPLES) {
            setCapturing(false);
            setHint(`Captured. Save ${first}’s Face ID?`);
            return;
          }
        }
      }
      window.setTimeout(tick, 120);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [open, capturing, stream, videoRef, first]);

  const begin = () => {
    setSamples([]);
    setHint("Loading Face ID…");
    loadFaceEngine()
      .then(() => setCapturing(true))
      .catch(() => setHint("Face ID couldn’t load on this browser. Use Chrome or Edge."));
  };

  const save = () =>
    start(async () => {
      const r = await enrollFaceAction(memberId, samples, consent);
      if (!r.ok) return void notify.error(r.error);
      notify.success(`${first} can now check in with Face ID`);
      emitFeedback("success");
      onDone();
      onClose();
    });

  const remove = () =>
    start(async () => {
      const r = await deleteFaceAction(memberId);
      if (!r.ok) return void notify.error(r.error);
      notify.success("Face ID deleted");
      onDone();
      onClose();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setCapturing(false);
          setSamples([]);
          setConsent(false);
          setStep("guide");
          setIssue("none");
          onClose();
        }
      }}
    >
      <DialogContent className={step === "guide" ? "max-h-[92dvh] overflow-y-auto sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{enrolled ? "Update Face ID" : "Set up Face ID"}</DialogTitle>
          <DialogDescription>
            {step === "guide"
              ? `Before scanning, check ${first} is ready. It takes two seconds and saves a face signature — not a photo — used only for check-in here.`
              : `${first} looks at the camera and holds still for two seconds.`}
          </DialogDescription>
        </DialogHeader>

        {step === "guide" ? (
          <FaceGuideGrid />
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
            <div
              aria-hidden
              className="absolute top-[47%] left-1/2 aspect-[0.78] h-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/70 shadow-[0_0_0_200vmax_rgb(0_0_0/0.55)]"
            />
            {capturing && issue !== "none" && <FaceIssueCard issue={issue} dark className="absolute inset-x-3 top-3" />}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-3 text-sm text-white">
              <span className="rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">{error ?? (capturing || samples.length ? hint : "Ready when you are")}</span>
              <span className="flex gap-1" aria-label={`${samples.length} of ${SAMPLES} captured`}>
                {Array.from({ length: SAMPLES }, (_, i) => (
                  <span key={i} className={`size-2.5 rounded-full ${i < samples.length ? "bg-primary" : "bg-white/35"}`} />
                ))}
              </span>
            </div>
          </div>
        )}
        <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
          <span>{first} agrees to use Face ID for check-in. They can ask the gym to delete it at any time.</span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {enrolled ? (
            <Button variant="destructive-soft" onClick={remove} disabled={saving}>
              <Trash2 /> Delete Face ID
            </Button>
          ) : (
            <span />
          )}
          {step === "guide" ? (
            <Button onClick={() => setStep("scan")} disabled={!consent}>
              <Camera /> {first} is ready — open camera
            </Button>
          ) : samples.length >= SAMPLES ? (
            <Button onClick={save} loading={saving} disabled={!consent}>
              Save Face ID
            </Button>
          ) : (
            <Button onClick={begin} disabled={!consent || capturing || !!error}>
              <ScanFace /> {capturing ? "Scanning…" : "Scan face"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
