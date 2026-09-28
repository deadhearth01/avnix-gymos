const TONES = {
  brand: "bg-brand text-brand-ink hover:brightness-110",
  light: "bg-white text-gs-ink hover:bg-white/90",
  ink: "bg-gs-ink text-white hover:bg-gs-ink/85",
  "outline-light": "border border-white/35 text-white hover:border-white hover:bg-white/10",
  outline: "border border-gs-ink/20 text-gs-ink hover:border-gs-ink",
} as const;
export type Tone = keyof typeof TONES;

/** Pill button classes for the public gym site (usable from server and client components). */
export function buttonTone(tone: Tone, className = "") {
  return `inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-semibold whitespace-nowrap transition-[background-color,border-color,filter,transform] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${TONES[tone]} ${className}`;
}

/** "05:00" → "5 AM", "21:30" → "9:30 PM". */
export function formatHours(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const h = Number(match[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return match[2] === "00" ? `${hour} ${suffix}` : `${hour}:${match[2]} ${suffix}`;
}
