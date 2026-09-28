"use client";

import * as React from "react";
import type { WebHaptics } from "web-haptics";

/**
 * Tactile + audible feedback for every interaction.
 *
 * - Touch devices → web-haptics (Vibration API, iOS switch fallback).
 * - Pointer devices → tiny synthesized WebAudio cues (no audio files).
 * - A single delegated `pointerdown` listener gives every button, link,
 *   tab, switch, checkbox and menu item a "tap" cue. Elements may opt in to
 *   a different cue with `data-feedback="success|warning|error|select|none"`.
 */

export type FeedbackKind = "tap" | "select" | "success" | "warning" | "error" | "toggle";
type Settings = { haptics: boolean; sound: boolean; volume: number };

const BUS_EVENT = "gymos:feedback";

/** Fire a cue from anywhere (e.g. after a server action resolves). */
export function emitFeedback(kind: FeedbackKind) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BUS_EVENT, { detail: kind }));
}

const DEFAULTS: Settings = { haptics: true, sound: true, volume: 0.6 };
const STORAGE_KEY = "gymos.feedback";

type Ctx = {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  trigger: (kind?: FeedbackKind) => void;
};

const FeedbackContext = React.createContext<Ctx | null>(null);

const INTERACTIVE =
  'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], summary, label[for], input[type="checkbox"], input[type="radio"], select';

const HAPTIC_MAP: Record<FeedbackKind, string> = {
  tap: "light",
  select: "selection",
  toggle: "medium",
  success: "success",
  warning: "warning",
  error: "error",
};

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/* ── Sound design ───────────────────────────────────────────────────────── */
class UiSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last = 0;

  private ensure(volume: number) {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.master!.gain.value = 0.22 * volume;
    return this.ctx;
  }

  private tone(ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private click(ctx: AudioContext, start: number, brightness: number, peak: number) {
    // short band-passed noise burst → crisp mechanical "tick"
    const len = Math.floor(ctx.sampleRate * 0.018);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = brightness;
    bp.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = peak;
    src.connect(bp).connect(gain).connect(this.master!);
    src.start(start);
  }

  play(kind: FeedbackKind, volume: number) {
    const now = performance.now();
    if (kind === "tap" && now - this.last < 35) return; // de-dupe bursts
    this.last = now;
    const ctx = this.ensure(volume);
    if (!ctx) return;
    const t = ctx.currentTime + 0.001;
    switch (kind) {
      case "tap":
        this.click(ctx, t, 3200, 0.9);
        break;
      case "select":
        this.click(ctx, t, 4200, 0.7);
        break;
      case "toggle":
        this.click(ctx, t, 2400, 0.9);
        this.tone(ctx, 660, t, 0.05, "sine", 0.18);
        break;
      case "success":
        this.tone(ctx, 784, t, 0.11, "sine", 0.32);
        this.tone(ctx, 1175, t + 0.075, 0.16, "sine", 0.26);
        break;
      case "warning":
        this.tone(ctx, 540, t, 0.09, "triangle", 0.28);
        this.tone(ctx, 540, t + 0.12, 0.09, "triangle", 0.22);
        break;
      case "error":
        this.tone(ctx, 220, t, 0.14, "square", 0.08);
        this.tone(ctx, 180, t + 0.1, 0.18, "square", 0.07);
        break;
    }
  }
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [settings, setState] = React.useState<Settings>(() => (typeof window === "undefined" ? DEFAULTS : readSettings()));
  const settingsRef = React.useRef(settings);
  const hapticsRef = React.useRef<WebHaptics | null>(null);
  const soundRef = React.useRef<UiSound | null>(null);
  const touchRef = React.useRef(false);

  React.useEffect(() => {
    touchRef.current = window.matchMedia("(pointer: coarse)").matches;
    let cancelled = false;
    import("web-haptics").then(({ WebHaptics }) => {
      if (!cancelled) hapticsRef.current = new WebHaptics();
    });
    return () => {
      cancelled = true;
      hapticsRef.current?.destroy();
    };
  }, []);

  const setSettings = React.useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const trigger = React.useCallback((kind: FeedbackKind = "tap") => {
    const s = settingsRef.current;
    const isTouch = touchRef.current;
    if (isTouch && s.haptics && hapticsRef.current) {
      void hapticsRef.current.trigger(HAPTIC_MAP[kind] as never);
      return;
    }
    if (!isTouch && s.sound) {
      soundRef.current ??= new UiSound();
      soundRef.current.play(kind, s.volume);
    }
  }, []);

  // Global delegation: every interactive element gets a cue.
  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null;
      if (!el || el.closest('[data-feedback="none"]')) return;
      if (el.matches(":disabled, [aria-disabled='true']")) return;
      const explicit = el.closest("[data-feedback]")?.getAttribute("data-feedback") as FeedbackKind | null;
      const role = el.getAttribute("role");
      const kind: FeedbackKind =
        explicit ??
        (role === "switch" || role === "checkbox" || el.matches("input[type=checkbox]")
          ? "toggle"
          : role === "tab" || role === "option" || role?.startsWith("menuitem")
            ? "select"
            : "tap");
      trigger(kind);
    };
    const onBus = (e: Event) => trigger((e as CustomEvent<FeedbackKind>).detail);
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener(BUS_EVENT, onBus);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener(BUS_EVENT, onBus);
    };
  }, [trigger]);

  const value = React.useMemo(() => ({ settings, setSettings, trigger }), [settings, setSettings, trigger]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const ctx = React.useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
