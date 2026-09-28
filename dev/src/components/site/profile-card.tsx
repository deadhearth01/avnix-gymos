"use client";

/**
 * Adapted from React Bits "ProfileCard" (TypeScript + Tailwind variant).
 * Changes: sized to its grid column, brand-coloured gradients, glow/shine fade in on hover,
 * keyframes live in globals.css, initials fallback when a trainer has no portrait.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";

const ANIMATION_CONFIG = {
  INITIAL_DURATION: 1200,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  ENTER_TRANSITION_MS: 180,
} as const;

const clamp = (v: number, min = 0, max = 100): number => Math.min(Math.max(v, min), max);
const round = (v: number, precision = 3): number => parseFloat(v.toFixed(precision));
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number): number => round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

type ProfileCardProps = {
  avatarUrl: string | null;
  name: string;
  title: string;
  handle?: string;
  status?: string;
  contactText?: string;
  brand: string;
  enableTilt?: boolean;
  onContactClick?: () => void;
  className?: string;
};

type TiltEngine = {
  setImmediate: (x: number, y: number) => void;
  setTarget: (x: number, y: number) => void;
  toCenter: () => void;
  beginInitial: (durationMs: number) => void;
  getCurrent: () => { x: number; y: number; tx: number; ty: number };
  cancel: () => void;
};

function ProfileCardComponent({
  avatarUrl,
  name,
  title,
  handle,
  status,
  contactText = "Book a session",
  brand,
  enableTilt = true,
  onContactClick,
  className = "",
}: ProfileCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  const leaveRafRef = useRef<number | null>(null);

  const tiltEngine = useMemo<TiltEngine | null>(() => {
    if (!enableTilt) return null;
    let rafId: number | null = null;
    let running = false;
    let lastTs = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    const DEFAULT_TAU = 0.14;
    const INITIAL_TAU = 0.6;
    let initialUntil = 0;

    const setVarsFromXY = (x: number, y: number) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap) return;
      const percentX = clamp((100 / (shell.clientWidth || 1)) * x);
      const percentY = clamp((100 / (shell.clientHeight || 1)) * y);
      const centerX = percentX - 50;
      const centerY = percentY - 50;
      const properties: Record<string, string> = {
        "--pointer-x": `${percentX}%`,
        "--pointer-y": `${percentY}%`,
        "--background-x": `${adjust(percentX, 0, 100, 35, 65)}%`,
        "--background-y": `${adjust(percentY, 0, 100, 35, 65)}%`,
        "--pointer-from-center": `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        "--pointer-from-top": `${percentY / 100}`,
        "--pointer-from-left": `${percentX / 100}`,
        "--rotate-x": `${round(-(centerX / 5))}deg`,
        "--rotate-y": `${round(centerY / 4)}deg`,
      };
      for (const [k, v] of Object.entries(properties)) wrap.style.setProperty(k, v);
    };

    const step = (ts: number) => {
      if (!running) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const k = 1 - Math.exp(-dt / (ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU));
      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;
      setVarsFromXY(currentX, currentY);
      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        rafId = requestAnimationFrame(step);
      } else {
        running = false;
        lastTs = 0;
        rafId = null;
      }
    };
    const start = () => {
      if (running) return;
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(step);
    };

    return {
      setImmediate(x, y) {
        currentX = x;
        currentY = y;
        setVarsFromXY(x, y);
      },
      setTarget(x, y) {
        targetX = x;
        targetY = y;
        start();
      },
      toCenter() {
        const shell = shellRef.current;
        if (shell) this.setTarget(shell.clientWidth / 2, shell.clientHeight / 2);
      },
      beginInitial(durationMs) {
        initialUntil = performance.now() + durationMs;
        start();
      },
      getCurrent: () => ({ x: currentX, y: currentY, tx: targetX, ty: targetY }),
      cancel() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        running = false;
        lastTs = 0;
      },
    };
  }, [enableTilt]);

  const offsets = (evt: PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell || !tiltEngine || event.pointerType === "touch") return;
      const { x, y } = offsets(event, shell);
      tiltEngine.setTarget(x, y);
    },
    [tiltEngine],
  );

  const handlePointerEnter = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell || !tiltEngine || event.pointerType === "touch") return;
      shell.classList.add("active", "entering");
      wrapRef.current?.style.setProperty("--card-opacity", "1");
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = window.setTimeout(() => shell.classList.remove("entering"), ANIMATION_CONFIG.ENTER_TRANSITION_MS);
      const { x, y } = offsets(event, shell);
      tiltEngine.setTarget(x, y);
    },
    [tiltEngine],
  );

  const handlePointerLeave = useCallback(() => {
    const shell = shellRef.current;
    if (!shell || !tiltEngine) return;
    tiltEngine.toCenter();
    wrapRef.current?.style.setProperty("--card-opacity", "0");
    const checkSettle = () => {
      const { x, y, tx, ty } = tiltEngine.getCurrent();
      if (Math.hypot(tx - x, ty - y) < 0.6) {
        shell.classList.remove("active");
        leaveRafRef.current = null;
      } else {
        leaveRafRef.current = requestAnimationFrame(checkSettle);
      }
    };
    if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
    leaveRafRef.current = requestAnimationFrame(checkSettle);
  }, [tiltEngine]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!tiltEngine || !shell) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = handlePointerMove as EventListener;
    const enter = handlePointerEnter as EventListener;
    const leave = handlePointerLeave as EventListener;
    shell.addEventListener("pointerenter", enter);
    shell.addEventListener("pointermove", move);
    shell.addEventListener("pointerleave", leave);
    tiltEngine.setImmediate((shell.clientWidth || 0) - ANIMATION_CONFIG.INITIAL_X_OFFSET, ANIMATION_CONFIG.INITIAL_Y_OFFSET);
    tiltEngine.toCenter();
    tiltEngine.beginInitial(ANIMATION_CONFIG.INITIAL_DURATION);
    return () => {
      shell.removeEventListener("pointerenter", enter);
      shell.removeEventListener("pointermove", move);
      shell.removeEventListener("pointerleave", leave);
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
      tiltEngine.cancel();
      shell.classList.remove("entering");
    };
  }, [tiltEngine, handlePointerMove, handlePointerEnter, handlePointerLeave]);

  const cardRadius = "28px";
  const cardStyle = {
    "--icon": "none",
    "--inner-gradient": `linear-gradient(150deg, color-mix(in oklab, ${brand} 55%, transparent) 0%, color-mix(in oklab, ${brand} 8%, #0d0e11) 70%)`,
    "--behind-glow-color": `color-mix(in oklab, ${brand} 70%, transparent)`,
    "--behind-glow-size": "50%",
    "--pointer-x": "50%",
    "--pointer-y": "50%",
    "--pointer-from-center": "0",
    "--pointer-from-top": "0.5",
    "--pointer-from-left": "0.5",
    "--card-opacity": "0",
    "--rotate-x": "0deg",
    "--rotate-y": "0deg",
    "--background-x": "50%",
    "--background-y": "50%",
    "--card-radius": cardRadius,
  } as React.CSSProperties;

  const shineStyle: React.CSSProperties = {
    maskImage: "var(--icon)",
    filter: "brightness(0.66) contrast(1.33) saturate(0.33)",
    opacity: "calc(0.08 + 0.35 * var(--card-opacity))",
    transition: "opacity 300ms ease",
    animation: "pc-holo-bg 18s linear infinite",
    mixBlendMode: "color-dodge",
    transform: "translate3d(0, 0, 1px)",
    overflow: "hidden",
    zIndex: 3,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundImage: `repeating-linear-gradient(0deg, hsl(2,100%,73%) 5%, hsl(53,100%,69%) 10%, hsl(93,100%,69%) 15%, hsl(176,100%,76%) 20%, hsl(228,100%,74%) 25%, hsl(283,100%,73%) 30%, hsl(2,100%,73%) 35%), repeating-linear-gradient(-45deg, #0e152e 0%, hsl(180,10%,60%) 3.8%, hsl(180,29%,66%) 4.5%, hsl(180,10%,60%) 5.2%, #0e152e 10%, #0e152e 12%), radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y), hsla(0,0%,0%,0.1) 12%, hsla(0,0%,0%,0.15) 20%, hsla(0,0%,0%,0.25) 120%)`,
    gridArea: "1 / -1",
    borderRadius: cardRadius,
    pointerEvents: "none",
  };

  const glareStyle: React.CSSProperties = {
    transform: "translate3d(0, 0, 1.1px)",
    overflow: "hidden",
    backgroundImage: "radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y), hsl(248, 25%, 80%) 12%, hsla(207, 40%, 30%, 0.8) 90%)",
    mixBlendMode: "overlay",
    filter: "brightness(0.8) contrast(1.2)",
    opacity: "calc(0.35 + 0.65 * var(--card-opacity))",
    transition: "opacity 300ms ease",
    zIndex: 4,
    gridArea: "1 / -1",
    borderRadius: cardRadius,
    pointerEvents: "none",
  };

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={wrapRef} className={`relative ${className}`.trim()} style={{ perspective: "600px", transform: "translate3d(0, 0, 0.1px)", ...cardStyle }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ease-out"
        style={{
          background: "radial-gradient(circle at var(--pointer-x) var(--pointer-y), var(--behind-glow-color) 0%, transparent var(--behind-glow-size))",
          filter: "blur(50px) saturate(1.1)",
          opacity: "calc(0.8 * var(--card-opacity))",
        }}
      />
      <div ref={shellRef} className="group relative z-[1]">
        <section
          aria-label={`${name}, ${title}`}
          className="relative grid w-full overflow-hidden"
          style={{
            aspectRatio: "0.74",
            borderRadius: cardRadius,
            boxShadow: "rgba(0, 0, 0, 0.55) calc((var(--pointer-from-left) * 10px) - 3px) calc((var(--pointer-from-top) * 20px) - 6px) 24px -8px",
            transition: "transform 1s ease",
            transform: "translateZ(0) rotateX(0deg) rotateY(0deg)",
            background: "#0d0e11",
            backfaceVisibility: "hidden",
          }}
          onMouseEnter={(e) => {
            if (!tiltEngine) return;
            e.currentTarget.style.transition = "none";
            e.currentTarget.style.transform = "translateZ(0) rotateX(var(--rotate-y)) rotateY(var(--rotate-x))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transition = shellRef.current?.classList.contains("entering") ? "transform 180ms ease-out" : "transform 1s ease";
            e.currentTarget.style.transform = "translateZ(0) rotateX(0deg) rotateY(0deg)";
          }}
        >
          <div className="absolute inset-0 grid" style={{ backgroundImage: "var(--inner-gradient)", borderRadius: cardRadius, gridArea: "1 / -1" }}>
            <div style={shineStyle} />
            <div style={glareStyle} />

            <div
              className="overflow-visible"
              style={{ transform: "translateZ(2px)", gridArea: "1 / -1", borderRadius: cardRadius, backfaceVisibility: "hidden" }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- transform-driven layer; next/image adds a wrapper that breaks the 3D stack
                <img
                  className="absolute bottom-[-1px] left-1/2 w-[80%] will-change-transform"
                  src={avatarUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{
                    transformOrigin: "50% 100%",
                    transform:
                      "translateX(calc(-50% + (var(--pointer-from-left) - 0.5) * 6px)) translateZ(0) scaleY(calc(1 + (var(--pointer-from-top) - 0.5) * 0.02)) scaleX(calc(1 + (var(--pointer-from-left) - 0.5) * 0.01))",
                    transition: "transform 120ms ease-out",
                  }}
                />
              ) : (
                <span aria-hidden className="gs-display absolute inset-0 grid place-items-center text-[7rem] text-white/15">
                  {initials}
                </span>
              )}
              <div
                className="absolute z-[2] flex items-center justify-between gap-3 border border-white/10 backdrop-blur-[30px]"
                style={{ bottom: 16, left: 16, right: 16, background: "rgba(255, 255, 255, 0.1)", borderRadius: 18, padding: "10px 10px 10px 14px" }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm leading-tight font-semibold text-white">{handle ? `@${handle}` : name}</p>
                  {status && <p className="mt-1 truncate text-xs leading-tight text-white/70">{status}</p>}
                </div>
                {onContactClick && (
                  <button
                    type="button"
                    onClick={onContactClick}
                    aria-label={`${contactText} with ${name}`}
                    className="min-h-10 shrink-0 cursor-pointer rounded-xl border border-white/15 px-3.5 text-xs font-semibold text-white backdrop-blur-[10px] transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-white/50 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {contactText}
                  </button>
                )}
              </div>
            </div>

            <div
              className="pointer-events-none relative z-[5] max-h-full overflow-hidden text-center"
              style={{
                transform: "translate3d(calc(var(--pointer-from-left) * -6px + 3px), calc(var(--pointer-from-top) * -6px + 3px), 0.1px)",
                gridArea: "1 / -1",
              }}
            >
              <div className="absolute inset-x-0 top-7 flex flex-col items-center px-4">
                <h3 className="gs-display text-[clamp(2.2rem,4.2vw,3.1rem)] text-white">{name}</h3>
                <p className="mt-1.5 text-sm font-medium text-white/75">{title}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const ProfileCard = React.memo(ProfileCardComponent);
