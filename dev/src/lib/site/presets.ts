/**
 * Stock photography bundled with GymOS (generated for us, no licence strings attached).
 * A site image slot holds either an Appwrite file id or `preset:<name>`.
 */
export const PHOTO_PRESETS = {
  "hero-deadlift": "Deadlift by the windows",
  "hero-ropes": "Battle ropes",
  "weights-rack": "Dumbbell rack",
  "cardio-deck": "Cardio deck at sunrise",
  kettlebell: "Kettlebell swing",
  spotting: "Spotting on the bench",
  "stretch-zone": "Stretch zone",
  lockers: "Locker room",
  "pt-session": "Personal training",
  community: "Group class",
} as const;

export const TRAINER_PRESETS = { kiran: "Kiran", sravani: "Sravani", arjun: "Arjun" } as const;

/** Illustrated default logos, used until a gym uploads its own. */
export const LOGO_PRESETS = {
  athlete: "Athlete",
  barbell: "Barbell",
  "flex-dumbbell": "Flexed arm",
  kettlebell: "Kettlebell",
  panda: "Panda",
  runner: "Runner",
} as const;
export type LogoPreset = keyof typeof LOGO_PRESETS;
export const LOGO_NAMES = Object.keys(LOGO_PRESETS) as LogoPreset[];

export type PhotoPreset = keyof typeof PHOTO_PRESETS;
const PREFIX = "preset:";

export function isPreset(id: string | null | undefined): id is `preset:${string}` {
  if (!id?.startsWith(PREFIX)) return false;
  const name = id.slice(PREFIX.length);
  return (
    name in PHOTO_PRESETS || (name.startsWith("trainer-") && name.slice(8) in TRAINER_PRESETS) || (name.startsWith("logo-") && name.slice(5) in LOGO_PRESETS)
  );
}

/** Path of a bundled preset, or null when `id` is not a known preset. */
export function presetUrl(id: string | null | undefined, size: "sm" | "lg" = "lg"): string | null {
  if (!isPreset(id)) return null;
  const name = id.slice(PREFIX.length);
  if (name.startsWith("trainer-")) return `/site-defaults/trainers/${name.slice(8)}.webp`;
  if (name.startsWith("logo-")) return `/site-defaults/logos/${name.slice(5)}.webp`;
  return `/site-defaults/${name}${size === "sm" ? "-sm" : ""}.webp`;
}

export const preset = (name: PhotoPreset) => `${PREFIX}${name}`;
export const trainerPreset = (name: keyof typeof TRAINER_PRESETS) => `${PREFIX}trainer-${name}`;
export const logoPreset = (name: LogoPreset) => `${PREFIX}logo-${name}`;
export const isLogoPreset = (id: string | null | undefined) => !!id && id.startsWith(`${PREFIX}logo-`) && isPreset(id);
export const isDefaultLogoUrl = (url: string | null | undefined) => !!url && url.startsWith("/site-defaults/logos/");

/** Stable "random" default logo for a gym that never picked one (same gym → same icon everywhere). */
export function defaultLogoFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return logoPreset(LOGO_NAMES[Math.abs(h) % LOGO_NAMES.length]);
}

export function randomLogo() {
  return logoPreset(LOGO_NAMES[Math.floor(Math.random() * LOGO_NAMES.length)]);
}

/** "/site-defaults/logos/panda.webp" → "preset:logo-panda" (null for uploaded logos). */
export function logoPresetFromUrl(url: string | null | undefined) {
  const m = url ? /^\/site-defaults\/logos\/([\w-]+)\.webp$/.exec(url) : null;
  return m && m[1] in LOGO_PRESETS ? logoPreset(m[1] as LogoPreset) : null;
}
