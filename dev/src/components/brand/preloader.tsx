import { MARK_ARC, MARK_BAR } from "./logo";

/**
 * First-paint preloader. Pure CSS (no JS needed), so it shows instantly on a
 * full page load and gets out of the way on its own; client-side navigations
 * never show it because layouts persist.
 */
export function Preloader() {
  return (
    <div aria-hidden className="gymos-preloader">
      <svg viewBox="0 0 48 48" fill="none" className="size-14 text-primary">
        <path className="gymos-preloader-arc" d={MARK_ARC} stroke="currentColor" strokeWidth="7" strokeLinecap="round" pathLength={1} />
        <path className="gymos-preloader-bar" d={MARK_BAR} stroke="currentColor" strokeWidth="7" strokeLinecap="round" pathLength={1} />
        <circle className="gymos-preloader-hub" cx="24" cy="24" r="6" fill="currentColor" />
      </svg>
    </div>
  );
}
